# Little Journey — Remaining work after the functionality pass

This documents what was implemented in the June 2026 full-functionality pass and
what is intentionally left, grouped by whether it needs YOUR external accounts.

## ✅ Implemented in this pass (P0–P4)

- **P0 trust/correctness** — removed misleading claims (E2E encrypted, AI
  narratives, CDC/WHO), fixed false success alerts, stopped persisting broken
  local image URIs, admin placeholders, DOB validation, a11y tab labels, demo
  "Unknown" name.
- **P1 persistence** — `updateTimelineEntry`, `updateAttendance`, notification
  read-state, comment temp-id reconciliation, reaction rollback now persist;
  notifications + incidents fetched on startup; per-user namespaced cache.
- **P2 features** — new-conversation compose flow + `createConversation` RPC;
  child add/edit/delete CRUD; preference toggles persisted to
  `profiles.preferences`; emergency/incident notification fan-out (daycare-wide
  and per-child) with real witness/parent-notified fields.
- **P3 admin** — built + wired the four "Coming Soon" screens: Manage
  Classrooms, Manage Calendar, Send Announcement, Generate Report.
- **P4** — ResetPassword recovery-session guard + matching password policy;
  in-app Privacy/Terms modals from SignUp; demo daycare gated to `__DEV__`.

New migrations: **010** (profiles.preferences, create_conversation RPC,
announcements table). New services: classrooms, announcements.

## ⛔ Blocked on YOUR external accounts (not implemented — needs your input)

These were deliberately skipped because they require credentials/services only
you can provision. The app code has clean integration points where applicable.

| Feature | Needs | Notes |
|---|---|---|
| Real card payments / PaymentSheet | **Stripe** live keys + deployed edge functions | `list/create/detach` payment-method edge functions must be deployed; web has no card-entry equivalent. |
| Subscription cancel / downgrade / billing portal | **Stripe** Customer Portal | Add a `billing-portal` edge function; UI button to open it. |
| Auto-pay scheduled charges | **Stripe** off-session + a scheduler | Currently a saved preference only. |
| Real trial enforcement | **Stripe** + a `trial_ends_at` gate | Trial is created (status=trialing) but not enforced on expiry. |
| Voice/video calling | **Twilio / Agora** (or similar) | Fake call UI was removed; real calling needs a provider. |
| Staff invite emails / family invites | **Email provider** (Resend/SendGrid/SES) | Invite *codes* work; email *delivery* needs a provider + edge function. |
| Push delivery end-to-end | **Expo push + DB webhook secret** | `send-push` exists; set `PUSH_WEBHOOK_SECRET` + DB webhook header. |
| Message / app translation, i18n | **Translation API** + i18n library | Language/translation toggles persist but don't translate yet. |
| True end-to-end encryption | crypto design + key management | Copy now says "Encrypted & Secure" (TLS + RLS + at-rest), not E2E. |
| Hosted legal/support pages + Universal Links | **littlejourney.app** hosting | In-app legal screens work; deep-link verification needs the domain. |

## 🟢 Self-contained deferred — NOW DONE (commit 27331c7)

- ✅ Multi-photo gallery viewer (every photo a tile; swipe carousel + dots).
- ✅ Photo download-to-device (expo-media-library, lazy + web-guarded).
- ✅ Daily-report date navigation (prev/next day, date-scoped stats).
- ✅ In-thread message search + message edit/delete (soft-delete tombstone).
- ✅ Per-child COPPA consent audit trail (coppa_consents + policy version + signed name).
- ✅ Biometric login enforced (expo-local-authentication: hardware/enroll check + auth).
- ✅ Real nap-session start/end duration tracking.

## 🟡 Still deferred (lower value / not yet done)

- Typing/presence indicators in messaging (needs Realtime presence channels).
- Device-calendar / reminders integration (expo-calendar) — not added.
- Lint warning budget is now zero after the July 2026 production-readiness
  cleanup. TypeScript remains the source of truth for production type safety.

See `docs/FUNCTIONALITY_PUNCH_LIST.md` for the full itemized list with file:line.
