# Viewing Little Journey in Replit (web preview)

Little Journey is a React Native / Expo app. On Replit you view it as the **web
build** (Expo compiles the same app to a static website that runs in a browser).
No Replit AI agent is needed — the repo is preconfigured.

## Quick start (recommended) — import and press Run

The repo ships with `.replit`, `replit.nix`, and `.nvmrc` already set up.

1. In Replit: **Create App → Import from GitHub** → `nem6557-cmyk/LittleJourney`
   (branch `fix/cleanup-and-edge-fn-authz`). The app shows as **Little Journey**.
2. Press **Run**. The `Run Little Journey` workflow does:
   `npm install` (auto) → `npm run build:web` → `npm run serve:web`.
3. The web preview opens on port 3000 (mapped to 80) and renders the app
   (login screen first).

What the run command maps to:

```bash
npm run replit     # = build:web (expo export) then serve:web
# build:web  -> expo export --platform web --output-dir dist
# serve:web  -> serve -s dist -l tcp://0.0.0.0:${PORT:-3000}
```

Binding to `0.0.0.0` and using `$PORT` is required — Replit's proxy can't reach
`localhost`-only servers. `serve -s` serves the SPA (client routes fall back to
`index.html`), which is verified working.

> First build takes a couple of minutes (it bundles ~1500 modules). Subsequent
> runs are faster.

## Alternative — Expo web dev server (hot reload, heavier)

```bash
npm install
npx expo start --web --port 3000
```

Then open the forwarded port. Use only if you want live reload; the static
export above is the reliable preview path on Replit.

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
