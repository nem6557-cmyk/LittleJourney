# LittleJourney Production Release Runbook

Last updated: July 2026

This runbook is the production launch path after code review. It assumes the app
is shipping from `main` and that the operator has access to Supabase, Expo/EAS,
Apple App Store Connect, Google Play Console, Stripe, Sentry, and the
`littlejourney.app` domain.

## 1. Preflight

Run from the repository root:

```bash
npm ci
npm run verify:release
git status --short
```

Expected result:

- TypeScript passes.
- ESLint passes with zero warnings.
- Jest passes.
- The Expo web export succeeds.
- Playwright e2e passes.
- Only intentional release changes are present.

## 2. Production Environment

Confirm production values before building:

- `EXPO_PUBLIC_ENV=production`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_STRIPE_PRICE_STARTER`
- `EXPO_PUBLIC_STRIPE_PRICE_PROFESSIONAL`
- `EXPO_PUBLIC_STRIPE_PRICE_ENTERPRISE`
- `EXPO_PUBLIC_STRIPE_PRICE_PARENT_PREMIUM`
- `EXPO_PUBLIC_SENTRY_DSN`
- `EXPO_PUBLIC_PRIVACY_URL=https://littlejourney.app/privacy.html`
- `EXPO_PUBLIC_TERMS_URL=https://littlejourney.app/terms.html`
- `EAS_PROJECT_ID`
- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

Do not put Stripe secret keys, Supabase service-role keys, webhook secrets, or
Apple/Google service credentials in a committed `.env` file.

## 3. Supabase Production Database

You said you will handle Supabase login. After login, run:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npm run supabase:prod:check
npm run supabase:prod:push:dry-run
npm run supabase:prod:push
```

After migration:

- Confirm all migrations through `013_launch_hardening_invites_demo.sql` are applied.
- Confirm Supabase database security advisors have no error-level findings.
- Confirm Supabase performance advisors have no error-level findings.
- Confirm the `authorized_pickups` table is explicitly granted to authenticated roles. Supabase changed new table API exposure behavior in April 2026, so new tables should not be assumed API-visible without grants.
- Confirm RLS is enabled on every app table.
- Deploy or redeploy Edge Functions used in production.
- Set Edge Function secrets for Stripe, Sentry, push, and webhook verification.

Useful commands:

```bash
npx supabase functions deploy create-checkout
npx supabase functions deploy stripe-webhook
npx supabase functions deploy send-push
npx supabase functions deploy data-export
npx supabase functions deploy data-deletion
```

## 4. Stripe

Before production release:

- Switch to live-mode product and price IDs.
- Set Stripe webhook endpoint to the deployed `stripe-webhook` Edge Function.
- Verify webhook signing secret is set in Supabase.
- Run a live low-value subscription/payment test or Stripe-approved test flow.
- Confirm cancellation/refund/customer support process is documented.

## 5. Sentry

Before release:

- Confirm the production DSN is set.
- Confirm `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` are available to EAS builds.
- Confirm release/source-map upload succeeds in the EAS build logs.
- Confirm PII scrubbing remains enabled in `src/lib/sentry.ts`.

## 6. Web Release

```bash
EXPO_PUBLIC_ENV=production npm run build:web
```

Deploy `dist/` to the production web host. Then smoke-test:

- `/privacy.html`
- `/terms.html`
- `/support.html`
- Universal Link association files, if hosted by the same domain.
- Sign-in page loads without falling back to demo mode.

## 7. Mobile Release

Follow `docs/MOBILE_RELEASE_CHECKLIST.md`.

GitHub Actions now runs native EAS production builds only through manual
`workflow_dispatch` with `run_native_builds=true`. Do not trigger that manual
release path until the EAS production environment contains the required
Supabase, Stripe, Sentry, Apple, and Google values. Normal pushes still run
type-check, lint, and Jest without spending an hour on a remote native build.

Core commands:

```bash
npx eas-cli login
npx eas-cli whoami
npx eas-cli build --platform ios --profile production
npx eas-cli build --platform android --profile production
```

Submit only after legal/privacy review and staging smoke tests pass.

## 8. Production Smoke Test

Use staging/demo data only. Do not use real child data for app review or smoke
testing unless the daycare has explicitly authorized it.

Smoke-test:

- Admin sign-up or sign-in.
- Daycare onboarding.
- Parent invite code redemption.
- COPPA consent flow.
- Timeline entry with photo upload.
- Parent gallery view.
- Daily report view.
- Messaging send/edit/delete.
- Attendance update.
- Authorized pickup add/verify.
- Data export request.
- Data deletion request on a throwaway account.
- Push notification delivery.
- Stripe checkout and webhook state update.

## 9. Rollback Notes

- Mobile app rollback is app-store controlled. Keep the prior approved build available where platform policy allows.
- Web rollback should redeploy the previous static artifact.
- Database rollback must be planned per migration. Do not manually reverse a production migration without backing up and confirming dependent app versions.
- Edge Function rollback should redeploy the previous function bundle and restore previous secrets if changed.
