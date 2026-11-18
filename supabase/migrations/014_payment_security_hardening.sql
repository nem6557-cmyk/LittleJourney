-- ============================================================
-- 014: Payment & entitlement security hardening (pre-launch audit)
-- ============================================================
-- Problems closed here:
--   1. subscriptions / parent_subscriptions had client INSERT/UPDATE policies,
--      so any daycare admin could grant their own daycare 'enterprise/active'
--      and any parent could grant themselves 'premium/active' with no payment.
--      These rows are now written ONLY by the stripe-webhook (service role) and
--      the create_daycare RPC (SECURITY DEFINER).
--   2. profiles.stripe_customer_id was writable by its owner (profiles UPDATE
--      policy only pinned role/daycare_id). Edge functions now resolve the
--      Stripe customer from this column, so a user could point it at someone
--      else's customer and list/detach that person's cards. Locked.
--   3. daycares.stripe_account_id / stripe_onboarding_complete / subscription_tier
--      / trial_ends_at / max_children / max_classrooms were editable by the
--      daycare admin (UPDATE policy has no column scope). Locked.
--   4. "Users can create daycares" allowed any authenticated user to INSERT
--      arbitrary daycares directly (spam + pre-set billing columns). Onboarding
--      uses create_daycare() which bypasses RLS, so the policy is removed.
--   5. invoices could be inserted by an admin for ANY parent_id on the platform
--      (the create-invoice function then emails that stranger via Stripe), with
--      line items that don't match the total, and could be edited after the
--      Stripe invoice existed. Validated by trigger.
--
-- "Privileged" below means the service role (edge functions) or a database
-- owner session (migrations, SECURITY DEFINER RPCs). Plain `authenticated`
-- PostgREST callers are never privileged.

-- ── 1. Entitlement tables: read-only for clients ──
DROP POLICY IF EXISTS "Admins can update own daycare subscription" ON subscriptions;
DROP POLICY IF EXISTS "Admins can insert daycare subscription" ON subscriptions;
DROP POLICY IF EXISTS "Parents can update own subscription" ON parent_subscriptions;
DROP POLICY IF EXISTS "Parents can insert own subscription" ON parent_subscriptions;

REVOKE INSERT, UPDATE, DELETE ON subscriptions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON parent_subscriptions FROM anon, authenticated;

-- ── 2. Protected billing columns ──
CREATE OR REPLACE FUNCTION protect_profile_billing_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') = 'service_role'
     OR current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.stripe_customer_id IS NOT NULL THEN
      RAISE EXCEPTION 'stripe_customer_id cannot be set by clients' USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id THEN
    RAISE EXCEPTION 'stripe_customer_id cannot be changed by clients' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_profiles_protect_billing ON profiles;
CREATE TRIGGER tr_profiles_protect_billing
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_profile_billing_columns();

CREATE OR REPLACE FUNCTION protect_daycare_billing_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') = 'service_role'
     OR current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'daycares are created through create_daycare()' USING ERRCODE = '42501';
  END IF;

  IF NEW.stripe_account_id IS DISTINCT FROM OLD.stripe_account_id
     OR NEW.stripe_onboarding_complete IS DISTINCT FROM OLD.stripe_onboarding_complete
     OR NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier
     OR NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at
     OR NEW.max_children IS DISTINCT FROM OLD.max_children
     OR NEW.max_classrooms IS DISTINCT FROM OLD.max_classrooms THEN
    RAISE EXCEPTION 'billing columns on daycares are managed by the server' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_daycares_protect_billing ON daycares;
CREATE TRIGGER tr_daycares_protect_billing
  BEFORE INSERT OR UPDATE ON daycares
  FOR EACH ROW EXECUTE FUNCTION protect_daycare_billing_columns();

-- ── 3. No direct daycare creation ──
DROP POLICY IF EXISTS "Users can create daycares" ON daycares;

-- ── 4. Invoice integrity ──
-- A daycare admin may only invoice a parent who is (a) in the same daycare and
-- (b) linked to the invoiced child. Totals must equal the sum of line items.
-- Once a Stripe invoice exists, money-relevant fields are frozen and status is
-- driven exclusively by the webhook.
CREATE OR REPLACE FUNCTION validate_invoice_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_line_sum BIGINT;
  v_item JSONB;
BEGIN
  IF COALESCE(auth.role(), '') = 'service_role'
     OR current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.stripe_invoice_id IS DISTINCT FROM OLD.stripe_invoice_id
       OR NEW.daycare_id IS DISTINCT FROM OLD.daycare_id THEN
      RAISE EXCEPTION 'invoice Stripe/tenant linkage is immutable' USING ERRCODE = '42501';
    END IF;

    IF OLD.stripe_invoice_id IS NOT NULL THEN
      IF NEW.amount_cents IS DISTINCT FROM OLD.amount_cents
         OR NEW.parent_id IS DISTINCT FROM OLD.parent_id
         OR NEW.child_id IS DISTINCT FROM OLD.child_id
         OR NEW.line_items IS DISTINCT FROM OLD.line_items
         OR NEW.status IS DISTINCT FROM OLD.status
         OR NEW.paid_at IS DISTINCT FROM OLD.paid_at THEN
        RAISE EXCEPTION 'invoice already sent to Stripe; it can only change via payment events'
          USING ERRCODE = '42501';
      END IF;
      RETURN NEW;
    END IF;
  ELSE
    -- INSERT
    IF NEW.stripe_invoice_id IS NOT NULL OR NEW.paid_at IS NOT NULL OR NEW.status NOT IN ('draft', 'pending') THEN
      RAISE EXCEPTION 'new invoices must start as draft/pending with no payment data' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.amount_cents <= 0 OR NEW.amount_cents > 100000000 THEN
    RAISE EXCEPTION 'invoice amount must be between $0.01 and $1,000,000.00';
  END IF;

  IF jsonb_typeof(NEW.line_items) IS DISTINCT FROM 'array' OR jsonb_array_length(NEW.line_items) = 0 THEN
    RAISE EXCEPTION 'invoice needs at least one line item';
  END IF;

  v_line_sum := 0;
  FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.line_items) LOOP
    IF jsonb_typeof(v_item->'amount') IS DISTINCT FROM 'number'
       OR (v_item->>'amount')::NUMERIC <> trunc((v_item->>'amount')::NUMERIC)
       OR (v_item->>'amount')::NUMERIC <= 0 THEN
      RAISE EXCEPTION 'each line item amount must be a positive whole number of cents';
    END IF;
    v_line_sum := v_line_sum + (v_item->>'amount')::BIGINT;
  END LOOP;
  IF v_line_sum <> NEW.amount_cents THEN
    RAISE EXCEPTION 'line items (% cents) do not add up to the invoice total (% cents)', v_line_sum, NEW.amount_cents;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM profiles p
    JOIN parent_children pc ON pc.parent_id = p.id
    JOIN children c ON c.id = pc.child_id
    WHERE p.id = NEW.parent_id
      AND p.daycare_id = NEW.daycare_id
      AND pc.child_id = NEW.child_id
      AND c.daycare_id = NEW.daycare_id
  ) THEN
    RAISE EXCEPTION 'parent must belong to this daycare and be linked to the invoiced child'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_invoices_validate ON invoices;
CREATE TRIGGER tr_invoices_validate
  BEFORE INSERT OR UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION validate_invoice_write();

-- Invoices are never hard-deleted by clients once they exist in Stripe.
DROP POLICY IF EXISTS "Admins can manage daycare invoices" ON invoices;
CREATE POLICY "Admins can view daycare invoices"
  ON invoices FOR SELECT
  USING (daycare_id = get_user_daycare_id() AND get_user_role() = 'admin');
CREATE POLICY "Admins can create daycare invoices"
  ON invoices FOR INSERT
  WITH CHECK (daycare_id = get_user_daycare_id() AND get_user_role() = 'admin');
CREATE POLICY "Admins can update unsent daycare invoices"
  ON invoices FOR UPDATE
  USING (daycare_id = get_user_daycare_id() AND get_user_role() = 'admin')
  WITH CHECK (daycare_id = get_user_daycare_id() AND get_user_role() = 'admin');
CREATE POLICY "Admins can delete unsent daycare invoices"
  ON invoices FOR DELETE
  USING (
    daycare_id = get_user_daycare_id()
    AND get_user_role() = 'admin'
    AND stripe_invoice_id IS NULL
  );

-- ── 5. Webhook idempotency that survives handler failures ──
-- The webhook now inserts with status='processing' and flips to 'done' only on
-- success; a failed run deletes its row so Stripe's retry is processed.
ALTER TABLE stripe_events ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'done';
ALTER TABLE stripe_events ADD COLUMN IF NOT EXISTS event_type TEXT;

-- ── 6. Per-daycare Stripe lookups ──
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_stripe_customer
  ON profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_parent_subscriptions_stripe_sub ON parent_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe ON invoices(stripe_invoice_id);

-- ── 7. Overdue invoices ──
-- Overdue is a function of the due date, not of a failed payment attempt.
-- Schedule with pg_cron (see docs/PRODUCTION_RELEASE_RUNBOOK.md):
--   select cron.schedule('mark-overdue-invoices', '15 5 * * *', 'select public.mark_overdue_invoices()');
CREATE OR REPLACE FUNCTION public.mark_overdue_invoices()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE invoices SET status = 'overdue'
  WHERE status = 'pending' AND due_date < CURRENT_DATE;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.mark_overdue_invoices() FROM PUBLIC, anon, authenticated;

-- ── 8. Push de-duplication ──
-- send-push claims a notification by setting push_sent_at atomically, so the DB
-- webhook and a client-triggered dispatch can't both deliver the same push.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS push_sent_at TIMESTAMPTZ;

-- ── 9. Account deletion must not be blockable by history ──
-- attendance.check_in_by/check_out_by and milestones.noted_by referenced profiles
-- with NO ACTION, so any caregiver/admin who had ever checked a child in (or noted
-- a milestone) could not delete their account — a store-review blocker (Apple 5.1.1(v),
-- Google Play account-deletion policy). History is kept; the actor is anonymised.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conrelid::regclass AS tbl, c.conname, a.attname AS col
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.contype = 'f'
      AND c.confrelid = 'public.profiles'::regclass
      AND c.confdeltype IN ('a', 'r')
      AND NOT a.attnotnull
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.profiles(id) ON DELETE SET NULL',
                   r.tbl, r.conname, r.col);
  END LOOP;
END $$;

-- ── 10. Parents never see unsent (draft) invoices ──
-- Admins create invoices as 'draft'; create-invoice flips them to 'pending' when
-- they are actually sent through Stripe.
DROP POLICY IF EXISTS "Parents can view own invoices" ON invoices;
CREATE POLICY "Parents can view own invoices"
  ON invoices FOR SELECT
  USING (parent_id = auth.uid() AND status <> 'draft');
