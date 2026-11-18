# Little Journey — Deployment Guide

Run these from the project root. Steps marked **[you]** need your own login /
credentials. Everything is on `main` already.

Prereqs: Node 20 (`nvm use 20.20.2`), the Supabase CLI (`npm i -g supabase`),
and the EAS CLI (`npm i -g eas-cli`).

---

## 1. Supabase backend

### 1a. Link the project **[you]**
You need a Supabase project (create one at https://supabase.com if you haven't).
Grab its **project ref** (Settings → General).

```bash
supabase login            # opens a browser
supabase link --project-ref YOUR_PROJECT_REF
```

### 1b. Apply migrations (001–014)
```bash
supabase db push
```
This creates the schema, RLS, RPCs (`redeem_invite_code`, `create_daycare`,
`create_conversation`), and tables (announcements, coppa_consents, stripe_events).

> If `db push` complains the remote already has objects, you can instead run each
> file in the SQL editor in order 001→014, or `supabase migration repair`.

### 1c. Deploy the 12 edge functions
```bash
supabase functions deploy create-billing-portal
supabase functions deploy create-checkout
supabase functions deploy create-connect
supabase functions deploy create-invoice
supabase functions deploy create-setup-intent
supabase functions deploy data-deletion
supabase functions deploy data-export
supabase functions deploy detach-payment-method
supabase functions deploy list-payment-methods
supabase functions deploy set-default-payment-method
supabase functions deploy send-push
supabase functions deploy stripe-webhook
```
`config.toml` already sets `verify_jwt = false` for `stripe-webhook` and
`send-push` (they authenticate themselves), so the deploy honors that.

### 1d. Set edge-function secrets **[you]**
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are injected
automatically. You must set the rest:

```bash
supabase secrets set \
  STRIPE_SECRET_KEY=sk_test_xxx \
  STRIPE_WEBHOOK_SECRET=whsec_xxx \
  STRIPE_CONNECT_WEBHOOK_SECRET=whsec_yyy \
  STRIPE_PRICE_STARTER=price_xxx \
  STRIPE_PRICE_PROFESSIONAL=price_xxx \
  STRIPE_PRICE_ENTERPRISE=price_xxx \
  APP_ALLOWED_RETURN_ORIGINS=https://littlejourney.app \
  PUSH_WEBHOOK_SECRET=$(openssl rand -hex 32)
```
Note the `PUSH_WEBHOOK_SECRET` value you generated — you need it in step 1f.

### 1e. Wire the Stripe webhooks + portal **[you]**
Create **two** endpoints in Stripe (Developers → Webhooks), both pointing at
`https://YOUR_PROJECT_REF.functions.supabase.co/stripe-webhook`:

| Endpoint | Listen to | Signing secret goes in |
|---|---|---|
| Account events | `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `invoice.voided`, `invoice.marked_uncollectible` | `STRIPE_WEBHOOK_SECRET` |
| **Connected accounts** ("Listen to events on Connected accounts") | `account.updated` | `STRIPE_CONNECT_WEBHOOK_SECRET` |

Then enable the **Customer portal** (Settings → Billing → Customer portal): allow
cancel, plan switching between your 3 prices, and payment-method updates. The
app's "Manage billing / cancel" button opens it.

Schedule the nightly overdue-invoice job (SQL editor; needs the `pg_cron` extension):
```sql
select cron.schedule('mark-overdue-invoices', '15 5 * * *', 'select public.mark_overdue_invoices()');
```

### 1f. Wire the push DB webhook **[you]**
So new `notifications` rows trigger `send-push`. In Supabase → Database →
Webhooks → create:
- Table: `notifications`, Events: **Insert**
- Type: Supabase Edge Function → `send-push`
- HTTP Headers: add `x-webhook-secret: <the PUSH_WEBHOOK_SECRET from 1d>`

### 1g. Storage buckets
Migration 003 creates the buckets (`avatars`, `timeline-photos`, `documents`,
`daycare-assets`) and their policies. Just confirm they appear in the Storage tab.

---

## 2. Client config / env

Create `.env` (gitignored) from `.env.example` with YOUR real values:
```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
EXPO_PUBLIC_SENTRY_DSN=https://...        # optional
EXPO_PUBLIC_ENV=production                 # production THROWS if Supabase vars missing
```

Sanity check it boots with the real backend:
```bash
npm run web      # or: npm run replit  (builds + serves on :3000)
```

---

## 3. Mobile builds (EAS) **[you]**

```bash
eas login
# one-time, provisions EAS secrets used at build time:
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value https://YOUR_PROJECT_REF.supabase.co
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value your-anon-key
eas secret:create --scope project --name EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY --value pk_live_xxx
eas secret:create --scope project --name EXPO_PUBLIC_ENV --value production
# (add SENTRY_AUTH_TOKEN for source-map upload if you use Sentry)

eas build --profile preview --platform android     # shareable APK
eas build --profile production --platform all       # store builds
eas submit --profile production --platform ios       # needs Apple creds
```

---

## 4. Web hosting (optional — for the public web app + deep links) **[you]**

```bash
npm run build:web         # -> dist/
```
Deploy `dist/` to any static host (Vercel/Netlify/Cloudflare Pages, all free
tiers). For Universal Links / App Links to verify, host these at
`littlejourney.app`: `/.well-known/apple-app-site-association` and
`/.well-known/assetlinks.json`, plus `/privacy`, `/terms`, `/support`.

---

## Smallest path to "it works end to end"
1. Supabase: link → `db push` → deploy functions → set secrets (1a–1d).
2. Push DB webhook + secret (1f) so notifications fan out.
3. `.env` with real Supabase + Stripe **test** keys (section 2).
4. `eas build --profile preview --platform android` → install the APK and sign in.

Stripe webhook (1e) + store submission (3) + web hosting (4) can come after.
