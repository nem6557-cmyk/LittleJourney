# Store Submission Guide — App Store, Google Play, Microsoft Store

Last updated: November 2026. Read this with `docs/MOBILE_RELEASE_CHECKLIST.md`
(build mechanics) and `docs/PAYMENT_SECURITY_AUDIT.md` (what changed and why).

## 0. What is done in the repo vs. what only you can do

| Area | State |
|---|---|
| App icon, Android adaptive icon, splash, notification icon, favicon, PWA/Store icons | **Done** — real branded assets (the repo shipped Expo's grid placeholder, an automatic rejection). Regenerate any time: `CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/generate-brand-assets.mjs` |
| Billing-policy compliance (Apple 3.1.1 / Play Billing) | **Done** — no in-app purchase UI on iOS/Android; subscriptions are web-only; families never pay |
| In-app account deletion for **every** role (Apple 5.1.1(v)) | **Done** — parents, caregivers and admins; admin FK bug that blocked deletion fixed |
| Account-deletion web page (Play requirement) | **Done** — `public/delete-account.html` → `https://littlejourney.app/delete-account.html` |
| Placeholder/"coming soon"/"future update" text, fake features | **Removed** (fabricated caregiver quote, no-op dark mode, fake Auto-Pay, no-op language/translation, demo role switcher on real accounts) |
| Android permissions | **Trimmed** — `RECORD_AUDIO`, broad media-read permissions blocked; unused `expo-av` removed |
| iOS privacy manifest | **Updated** (payment info + device ID added) |
| PWA manifest / maskable icon / service worker | **Done** (Microsoft Store packaging) |
| Stripe live keys, webhook endpoints, price IDs, Connect | **You** — see `DEPLOY.md` §1 and the test-mode pass in `PAYMENT_SECURITY_AUDIT.md` |
| Apple Developer / Google Play / Partner Center accounts, signing, APNs key, FCM file | **You** |
| Hosting `littlejourney.app` (privacy, terms, support, delete-account, `.well-known`) | **You** — `npm run build:web` → host `dist/` |
| Store screenshots, preview video, reviewer demo accounts | **You** — see §5 |
| Legal review of Terms/Privacy | **You** — text was updated to match the product; a lawyer should read it (COPPA applies: the app stores children's data) |

Nothing in this repo has been run on a physical device or against live Stripe,
Apple or Google services from this environment. Treat the first TestFlight /
internal-testing build as the real acceptance test.

## 1. Before any store

1. Apply migrations `001…014`, deploy the 12 edge functions, set secrets, wire both
   Stripe webhooks, enable the Stripe customer portal (`DEPLOY.md`).
2. Host the web build + legal pages on `https://littlejourney.app`.
3. Create the EAS secrets (`scripts/eas-push-secrets.mjs` helps) and run
   `npm run verify:release`.
4. Create a **review daycare** in production with one admin, one caregiver and one
   parent account (real signups + invite codes — the demo daycare RPC is revoked in
   production by design). Seed a few timeline entries, a photo, a message, and one
   unpaid invoice. You'll hand these credentials to the reviewers.

## 2. Apple App Store

1. Apple Developer Program, then create the App Store Connect record:
   bundle id `com.littlejourney.app`, SKU anything, primary language English (US).
2. `eas credentials` (let EAS manage the distribution certificate/profile and
   create the **APNs key** for push), then:
   ```bash
   npx eas-cli build --platform ios --profile production
   npx eas-cli submit --platform ios --profile production   # needs APPLE_ID, ASC_APP_ID, APPLE_TEAM_ID
   ```
3. **Universal Links** — host `https://littlejourney.app/.well-known/apple-app-site-association`
   (no extension, `application/json`):
   ```json
   { "applinks": { "details": [ { "appIDs": ["<TEAMID>.com.littlejourney.app"], "components": [ { "/": "/*" } ] } ] } }
   ```
4. **App Privacy ("nutrition label")** — declare, all *linked to the user*, *not used
   for tracking*: **Contact Info** (name, email, phone), **Health** (allergies and
   medical notes entered for a child — `app.config.ts` declares it, so answer
   consistently), **Other User Content**, **Photos or Videos**, **Messages**
   (emails or text messages), **User ID**, **Device ID** (push token),
   **Purchase History** and **Payment Info** (collected by Stripe), **Crash Data**
   and **Performance Data** (Sentry). This matches `ios.privacyManifests` in
   `app.config.ts`. Tracking: **No**.
5. **Age rating**: 4+ is accurate for content, but the app handles children's
   *data*. It is for adults (parents, staff) — do **not** submit under the Kids
   category.
6. **Review notes** (paste into App Review Information):
   > Little Journey connects daycare staff and parents. Sign-in is required.
   > Demo accounts (one per role) are below; all belong to the "App Review Daycare".
   > Account deletion: Profile → Download My Data → Delete My Account (all roles).
   > Subscriptions for daycares are purchased on our website only, not in the app;
   > families (parents) never pay. Tuition invoices are real-world childcare
   > payments (Guideline 3.1.3(e)) completed on a Stripe-hosted page.
   > Admin demo: … / Caregiver demo: … / Parent demo: …
7. Export compliance is pre-answered (`ITSAppUsesNonExemptEncryption: false`: TLS only).
8. Screenshots: 6.9" iPhone (1320×2868) and 6.5" (1284×2778); iPad only if you keep
   `supportsTablet: true` (then 13" iPad too). Set `supportsTablet: false` in
   `app.config.ts` to skip iPad screenshots.

## 3. Google Play

1. Play Console developer account, create the app (`com.littlejourney.app`).
2. **FCM for push**: create a Firebase project, add the Android app, download
   `google-services.json`, and give it to EAS as a *file* env var
   `GOOGLE_SERVICES_JSON` (`eas secret:create --type file`). `app.config.ts` picks
   it up. Upload your FCM v1 service-account key to EAS for Expo push.
3. **Play service account** for `eas submit`: save its JSON as
   `./play-service-account.json` (gitignored). First upload to Play must be done
   once by hand in the console, then `eas submit` works.
   ```bash
   npx eas-cli build --platform android --profile production   # produces an AAB
   npx eas-cli submit --platform android --profile production  # internal track
   ```
4. **App Links** — host `https://littlejourney.app/.well-known/assetlinks.json` with
   the SHA-256 of the *Play App Signing* certificate (Play Console → App integrity):
   ```json
   [{ "relation": ["delegate_permission/common.handle_all_urls"],
      "target": { "namespace": "android_app", "package_name": "com.littlejourney.app",
                  "sha256_cert_fingerprints": ["<PLAY_APP_SIGNING_SHA256>"] } }]
   ```
5. **Data safety form**: same data types as §2.4; "data encrypted in transit: yes";
   "users can request deletion: yes" with the URL
   `https://littlejourney.app/delete-account.html`; "data shared with third parties":
   none for advertising (Stripe/Supabase/Sentry/Expo act as processors).
6. **Target audience**: 18+ (adults: parents/caregivers/administrators). Selecting
   under-13 would trigger the Families policy.
7. **Payments policy**: no digital goods are sold in the app, so Play Billing is not
   required. Tuition is a real-world service.
8. New *personal* developer accounts must run a closed test with a minimum number of
   testers for a minimum number of days before production access (rule at time of
   writing — check Play Console). Organization accounts are exempt.
9. Permissions declared: camera (activity photos), notifications, vibrate,
   receive-boot-completed (scheduled notifications). Nothing sensitive requires a
   declaration form.

## 4. Microsoft Store

The web app is a PWA (manifest, maskable icons, service worker, HTTPS-only deep
links), which the Store accepts as an MSIX.

1. Host the web build at `https://littlejourney.app` (`npm run build:web` → `dist/`).
2. Partner Center account, reserve the name "Little Journey Daycare".
3. Generate the package at <https://www.pwabuilder.com> from the live URL; use
   `public/icon-512.png` / `icon-maskable-512.png` / `icon-150.png` and set the
   *Package ID* from your Partner Center identity.
4. Age rating via the IARC questionnaire (no objectionable content). Category:
   Education (or Productivity). Privacy policy URL: `https://littlejourney.app/privacy.html`.
5. Submit with 1366×768 desktop screenshots (3–4) and a 300×300 tile if requested.
6. Subscriptions/tuition run on the web flows (Stripe Checkout / hosted invoice), which
   Microsoft permits for non-game apps via a third-party commerce engine.

## 5. Things only a human can produce

* **Screenshots** — capture real data from the review daycare (the demo mode in
  `npm run web` shows empty states, not good marketing shots).
* **Support** — `support@`, `privacy@`, `legal@littlejourney.app` mailboxes must exist
  before submission (reviewers and Google's policy team do email them).
* **Business decisions flagged for you**: 5% platform fee, 30-day deletion SLA on the
  deletion page, no hard trial enforcement, refund wording in the Terms.

## 6. Known limitations to be upfront about

* The UI is light-mode only (dark mode is not implemented; the toggle was removed
  rather than shipped half-working).
* Language/translation and auto-pay are not implemented and are no longer shown.
* Voice/video calling, staff-invite *emails* (codes work), typing indicators and
  device-calendar sync are not implemented (`docs/REMAINING_WORK.md`).
* Daycare subscriptions can only be bought on the web. If you later want
  in-app purchase, you must integrate StoreKit / Play Billing (e.g. RevenueCat).
