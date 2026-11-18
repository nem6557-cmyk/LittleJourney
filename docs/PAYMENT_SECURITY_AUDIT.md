# Payment & Entitlement Security Audit

Audit date: November 2026. Scope: Supabase RLS/migrations, all Stripe edge
functions, and the client billing flows. Every database finding below was
reproduced against a local Postgres 16 with Supabase-style roles *before* the
fix and re-tested *after* (see "How this was verified").

## Critical findings (fixed in migration `014` + new edge functions)

| # | Finding | Impact | Fix |
|---|---|---|---|
| 1 | `subscriptions` allowed client INSERT/UPDATE for the daycare admin | Any admin could set their daycare to `enterprise / active` for free | Client writes revoked; only the webhook (service role) and `create_daycare()` write |
| 2 | `parent_subscriptions` allowed client INSERT/UPDATE by the parent | Any parent could grant themselves `premium / active` | Same |
| 3 | `profiles.stripe_customer_id` writable by its owner | A user could point their profile at *someone else's* Stripe customer and then list/detach that person's cards | Column write-protected by trigger |
| 4 | `daycares` billing columns (`stripe_account_id`, `stripe_onboarding_complete`, `subscription_tier`, `trial_ends_at`, `max_*`) editable by the admin | Self-granted tier/limits, extended trial, re-pointed payouts | Protected by trigger |
| 5 | `"Users can create daycares"` INSERT policy (any signed-in user) | Spam tenants with pre-set billing fields | Policy dropped (onboarding uses the `create_daycare()` RPC) |
| 6 | Invoices: admin could invoice **any** user on the platform, with line items ≠ total, and edit amounts after the Stripe invoice existed | Stripe emails strangers; displayed total ≠ charged total | Validation trigger: parent must be in the daycare and linked to the child, totals must match, sent invoices are immutable; admins can only delete unsent invoices |
| 7 | `stripe-webhook` used synchronous `constructEvent` | Throws under Deno's WebCrypto, so **every real webhook would 400** and no invoice/subscription would ever update | `constructEventAsync` + SubtleCrypto provider |
| 8 | Webhook dedupe row was written *before* processing and kept on failure | One transient error permanently swallowed the event | `processing → done`, row released on failure so Stripe retries |
| 9 | `create-invoice` returned the hosted-invoice URL to **any authenticated user** (idempotent branch ran before the authorization check) | Cross-tenant leak of payment links | Authorize first; only that daycare's admin or the invoice's parent |
| 10 | Parents could not pay: `create-invoice` required admin, but the parent's "Pay Now" called it | Tuition payment flow was broken | Parent of the invoice may open/pay it |
| 11 | `create-connect` was never called by the app | No daycare could ever finish Stripe onboarding, so invoicing could never work | New admin **Billing & Payments** screen |
| 12 | `list/detach-payment-method` and `create-setup-intent` resolved the Stripe customer by **email** | Mutable, non-unique identity | Stored, write-protected customer id |
| 13 | `returnUrl` from the client passed straight into Stripe `success_url` / account links | Open redirect after payment | Allow-list (`littlejourney://` + `APP_ALLOWED_RETURN_ORIGINS`) |
| 14 | `create-checkout` trusted client `daycareId` for parent plans; no check for an existing subscription; a second free 14-day trial on top of the in-app trial | Subscription for the wrong tenant, duplicate subscriptions, trial farming | Admin-only, daycare from profile, 409 if already subscribed, trial honoured once |
| 15 | `send-push` let *any* caregiver/admin push arbitrary title/body to *any* user id (any tenant); secret compared with `===` | Phishing / spam via push | Title/body/target read from the DB row; staff limited to own daycare; constant-time compare; idempotent claim (`push_sent_at`) |
| 16 | Raw `err.message` returned to clients from every function | Leaks Stripe/Postgres internals | Generic message + server log |
| 17 | `attendance.check_in_by`, `check_out_by`, `milestones.noted_by` FKs were `NO ACTION` | Any caregiver/admin who had ever checked in a child **could not delete their account** (Apple 5.1.1(v) / Play deletion policy) | `ON DELETE SET NULL` |
| 18 | Parent could not pay **overdue** invoices (button only rendered for `pending`) | Lost revenue | Fixed; overdue is also derived from the due date |

## Not changed (needs a decision from you)

* **Platform fee (5%)** is now disclosed in the Billing screen, Terms, and store
  copy. Confirm it is what you want to charge; change with `PLATFORM_FEE_PERCENT`.
* **Trial is not hard-enforced.** Admins see a banner when the trial is ending /
  ended / payment failed, but nothing locks the daycare out. Locking out a
  childcare provider mid-day is a business decision, so it was left to you.
* **Invoices cascade-delete with the parent profile** (`invoices.parent_id ON
  DELETE CASCADE`). A parent who deletes their account removes that row from the
  daycare's history; Stripe keeps the financial record. Consider `SET NULL` if
  the daycare needs its own ledger.
* **Saved-card screen / edge functions** (`PaymentMethodsScreen`, `list/detach/
  set-default-payment-method`, `create-setup-intent`) are hardened but no longer
  linked from the UI — nothing consumes saved cards yet (invoices use Stripe's
  hosted page; subscriptions use Checkout + the portal). Keep them for a future
  auto-pay feature or remove `@stripe/stripe-react-native` to shrink the binary.

## How this was verified

* All 14 migrations applied in order to a clean Postgres 16 with `anon /
  authenticated / service_role` roles and `auth.uid()/auth.role()` shims.
* Pre-014 schema: exploits #1, #3, #4 reproduced (admin → `enterprise/active`,
  admin re-pointed `stripe_account_id`, parent set `stripe_customer_id` to a
  victim's id).
* Post-014: 11 attack statements (A1–A8, P1–P3) all rejected; the legitimate
  admin invoice insert, parent `push_token` update, and every service-role
  webhook write still succeed.
* Caregiver with attendance history can now be deleted (check-in actor → NULL).
* Edge functions type-checked against the real `stripe@14` and
  `@supabase/supabase-js@2` typings. They have **not** been run against live
  Stripe — do a full test-mode pass (below) before going live.

## Stripe test-mode acceptance pass (do before live keys)

1. Admin signs up → creates daycare → Billing → *Set up payments* → finish
   Express onboarding with Stripe test data → status flips to "Online payments are on".
2. Web: Plan & Billing → *Start free trial* (`4242 4242 4242 4242`) → subscription
   row becomes `trialing`/`active`; *Manage billing* opens the portal; cancel →
   `canceled`.
3. Admin → New invoice for a linked parent → parent receives push + email →
   *Pay Now* → pay with `4242…` → invoice flips to **Paid** and a "Payment
   Confirmed" notification arrives. Retry the webhook from the Stripe dashboard:
   no duplicate effects.
4. Pay with `4000 0000 0000 0002` (declined) → "Payment Failed" notification.
5. Confirm a second admin of *another* daycare gets 403 from `create-invoice`
   for the first daycare's invoice id.
