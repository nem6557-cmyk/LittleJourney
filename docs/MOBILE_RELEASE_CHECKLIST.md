# LittleJourney Mobile Release Checklist

Last updated: July 2026

Use this checklist for iOS and Android production builds. The app already has
production EAS profiles in `eas.json` and native permissions/privacy metadata in
`app.config.ts`.

## 1. Local Preflight

```bash
npm ci
npm run verify:release
```

The release should not proceed if type-check, lint, Jest, web export, or
Playwright fails.

## 2. EAS Login And Project

The verified EAS project id in `app.config.ts` is:

```text
65cb7e55-095b-440f-9340-dfe489247b67
```

Commands:

```bash
npx eas-cli login
npx eas-cli whoami
npx eas-cli project:info
```

Note: during this production-readiness pass, `npx eas` did not resolve cleanly
in the local npm cache. Use `npx eas-cli ...` or install `eas-cli` once the npm
cache/login environment is clean.

## 3. EAS Secrets

Set production secrets in EAS before building:

```bash
npx eas-cli secret:create --scope project --name EXPO_PUBLIC_ENV --value production
npx eas-cli secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value https://YOUR_PROJECT.supabase.co
npx eas-cli secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value YOUR_ANON_KEY
npx eas-cli secret:create --scope project --name EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY --value pk_live_...
npx eas-cli secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value https://...
npx eas-cli secret:create --scope project --name SENTRY_AUTH_TOKEN --value YOUR_SENTRY_AUTH_TOKEN
npx eas-cli secret:create --scope project --name SENTRY_ORG --value YOUR_SENTRY_ORG
npx eas-cli secret:create --scope project --name SENTRY_PROJECT --value littlejourney
```

Also set live Stripe price IDs:

```bash
npx eas-cli secret:create --scope project --name EXPO_PUBLIC_STRIPE_PRICE_STARTER --value price_...
npx eas-cli secret:create --scope project --name EXPO_PUBLIC_STRIPE_PRICE_PROFESSIONAL --value price_...
npx eas-cli secret:create --scope project --name EXPO_PUBLIC_STRIPE_PRICE_ENTERPRISE --value price_...
npx eas-cli secret:create --scope project --name EXPO_PUBLIC_STRIPE_PRICE_PARENT_PREMIUM --value price_...
```

## 4. iOS Readiness

Confirm in Apple Developer/App Store Connect:

- Bundle ID: `com.littlejourney.app`
- Associated domain: `applinks:littlejourney.app`
- Privacy Policy URL: `https://littlejourney.app/privacy.html`
- Support URL: `https://littlejourney.app/support.html`
- Export compliance answer matches `ITSAppUsesNonExemptEncryption=false`.
- Camera/photo permission copy matches actual usage.
- Apple privacy nutrition labels match the real data collected.
- Demo review account uses synthetic child/daycare data.
- App Review notes explain this is a childcare communication app requiring a linked daycare/parent account.

Build:

```bash
npx eas-cli build --platform ios --profile production
```

Submit:

```bash
npx eas-cli submit --platform ios --profile production
```

## 5. Android Readiness

Confirm in Google Play Console:

- Package: `com.littlejourney.app`
- Privacy Policy URL: `https://littlejourney.app/privacy.html`
- Data Safety form matches the real data collected.
- Content rating is complete.
- Target audience is accurate for a parent/caregiver/daycare operator app.
- Internal test track has at least one successful smoke test before production.
- `google-services.json` and service account key handling are correct for submit.

Build:

```bash
npx eas-cli build --platform android --profile production
```

Submit:

```bash
npx eas-cli submit --platform android --profile production
```

`eas.json` currently submits Android to the internal track first. Promote only
after smoke testing.

## 6. Mobile Smoke Test Matrix

Test on at least:

- iPhone small screen.
- iPhone large screen.
- iPad/tablet if supporting tablets remains enabled.
- Android small screen.
- Android large screen.

Critical flows:

- Login, logout, reset password.
- Daycare onboarding.
- Parent invite code redemption.
- COPPA consent.
- Timeline entry creation.
- Photo upload and gallery view.
- Messaging send/edit/delete.
- Attendance update.
- Daily report.
- Profile privacy settings.
- Data export and deletion on a throwaway account.
- Push notification opt-in and receipt.
- Stripe checkout or subscription flow.

## 7. Store Copy

Use `docs/STORE_LISTING.md` as the source draft, but update before submission:

- Replace placeholders for phone, demo account, and credentials.
- Confirm pricing is current and matches Stripe live prices.
- Confirm privacy claims match `docs/LEGAL_COMPLIANCE_READINESS.md`.
- Avoid absolute "compliant" claims unless counsel approves that wording.
