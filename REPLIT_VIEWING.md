# Viewing LittleJourney in Replit (web preview)

LittleJourney is a React Native / Expo app. On Replit you view it as the **web
build** (Expo can compile the same app to a static website that runs in a
browser). No Replit AI agent is needed — these are plain shell steps.

## Option A — Serve the prebuilt web bundle (fastest)

The repo can produce a static site in `dist/`. To build and serve it:

```bash
npm install
npx expo export --platform web --output-dir dist
npx serve dist          # or: python3 -m http.server -d dist 3000
```

In Replit:
1. Import the repo (GitHub → `nem6557-cmyk/LittleJourney`, branch
   `fix/cleanup-and-edge-fn-authz`).
2. In the Shell, run the three commands above.
3. Open the web preview pane on the served port. You'll see the app render
   (login screen first).

`dist/` contains `index.html` + a single JS bundle, so any static file server
works.

## Option B — Run the Expo web dev server

```bash
npm install
npm run web          # expo start --web
```

Then open the forwarded port in the Replit preview. This gives hot-reload but is
heavier than the static export.

## What you can actually do in the preview

- The UI renders and is navigable.
- **Real data / auth / payments require backend env vars.** Without them the app
  shows the login screen and (in development) a local demo mode. To exercise the
  real backend, set these as Replit Secrets before building:

  ```
  EXPO_PUBLIC_SUPABASE_URL=...
  EXPO_PUBLIC_SUPABASE_ANON_KEY=...
  EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=...
  EXPO_PUBLIC_SENTRY_DSN=...
  EXPO_PUBLIC_ENV=development
  ```

  > Note: in `production` the app intentionally **throws on startup** if the
  > Supabase vars are missing (no silent fake-demo fallback). Keep
  > `EXPO_PUBLIC_ENV=development` for a no-backend preview.

## Native (iOS / Android)

The web preview is for viewing. Real device builds go through EAS:

```bash
npx eas build --profile preview --platform android
```

The JS/Hermes bundle that powers native is verified to compile
(`npx expo export --platform android`). A full iOS `.ipa` needs macOS + Xcode
(or EAS cloud builds).

## Before a real deploy (not needed just to view)

These are operational steps, not code:
- Apply Supabase migrations `001`–`009` (`supabase db push`) and deploy the
  edge functions.
- Set `PUSH_WEBHOOK_SECRET` on the `send-push` function and add the
  `x-webhook-secret` header to the DB webhook.
- Provision Stripe / Supabase / Sentry secrets via EAS for production builds.
- Host the legal/support pages at `littlejourney.app` (privacy, terms, support,
  apple-app-site-association, assetlinks.json) for deep links + store review.
