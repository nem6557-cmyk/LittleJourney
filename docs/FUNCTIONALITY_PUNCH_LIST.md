# Little Journey — Full Functionality Punch List

A consolidated, deduplicated inventory of functionality gaps across 9 screen groups. Each item states what the code does today and what full functionality requires, with effort (S/M/L) and the primary code location.

---

## Themes (biggest cross-cutting gaps)

1. **Local-only writes that never persist to Supabase.** The single largest pattern. `updateTimelineEntry`, `updateAttendance`, `markNotificationRead`/`markAllNotificationsRead`, learning-plan activity completion, photo favorites, profile/notification/privacy toggles, and the "checked-in" flag all mutate React state (or at most AsyncStorage) with no DB round-trip. Changes vanish on refetch/reload and are invisible to other users/devices.

2. **Messaging is half-built.** No way to start a new conversation (no `createConversation` in context, `sendMessage` bails without an existing thread), no delete/edit of messages, photos overloaded into a `[photo:URL]` text hack, read receipts/unread counts hardcoded `false`/`0` on load, fake "Today" date separator, and vestigial dead call-UI styles.

3. **Notifications & incidents never load and rarely fan out.** Neither `notifications` nor `incidents` are fetched from Supabase on startup. Emergency alerts and incident "parent will be notified" promises don't actually push to parents (no `childId` → local-only; incident `parent_notified_at`/`witness_name` hardcoded null).

4. **Payments backend not deployed / not reconciled.** Payment-method list/add/remove/set-default all depend on edge functions noted as a pending deploy step; subscription screen can't cancel/downgrade/manage (no billing portal); plan prices are hardcoded and may drift from Stripe; auto-pay is cosmetic.

5. **Admin management is mostly stubs.** Classrooms, Calendar, Send Announcement, Generate Report are "Coming Soon" alerts. Staff invites write to a non-existent `invitations` table; child edit/delete/detail are unwired despite services existing.

6. **Misleading / fake claims (legal & trust risk).** "End-to-End Encrypted" (multiple screens), "AI-generated narratives" (templated strings), "Based on CDC/WHO guidelines", "Live Updates" badge, "14-Day Free Trial", and a "Save success" alert shown on PDF-export failure. These are app-store and legal exposures.

7. **Demo/sample data leaks into authenticated sessions.** Hardcoded fake children/users surface as real data when `profile` is null; emergency contacts, authorized pickups, and pediatrician have NO real Supabase fetch, so fake values are the only source. AsyncStorage cache is not namespaced per user (cross-account bleed risk).

8. **Read-only views where editing is expected.** Child profile, health/allergies, emergency contacts, lesson plans, incidents, milestones, and calendar events are display-only; create/edit/delete context methods and services are missing or unwired.

---

## Parent — Timeline & Gallery

- **Learning-plan activity checkbox** — toggles `activity.completed` in local state only, re-synced from context on remount so checkmarks are lost → add `learningPlansService.toggleActivityCompleted(...)` persisted to DB, optimistic with revert, wired through AppContext. (M · `GalleryScreen.tsx:210-223,632-644`)
- **Favorite/heart a photo** — `favoritePhotoIds` is local `useState` Set; nothing saved → persist (AsyncStorage per-user or Supabase favorites table), add a "Favorites" filter chip, load on mount. (M · `GalleryScreen.tsx:77,736-754`)
- **Share photo / album / with Pediatrician** — every Share calls `shareContent(message)` → only `Share.share({message})` with plain text (raw URI string, not the image/PDF); two near-duplicate modal Share buttons → use `expo-sharing` with a real downloaded file URL, generate a real milestone PDF for pediatrician, collapse duplicate buttons into distinct actions. (M · `GalleryScreen.tsx:382-397,717-735`)
- **Photo download / save to device** — no save action exists → add a Download button using `expo-media-library` (permission + `saveToLibraryAsync`) with success/failure feedback. (S · `GalleryScreen.tsx:717-755`)
- **Calendar event detail** — tapping an event shows a native `showAlert` string → replace with a styled event-detail modal/screen. (M · `GalleryScreen.tsx:517-523,560-566`)
- **Add to device calendar / reminders** — Calendar tab is read-only → integrate `expo-calendar` and/or `expo-notifications` for device events and pre-event reminders. (M · `GalleryScreen.tsx:491-591`)
- **Gallery shows only first photo per entry** — maps `photos[0]`, multi-photo entries contribute one tile → flatten all photos into the grid, let the modal page through every photo. (S · `GalleryScreen.tsx:127,679-685`)
- **Multi-photo viewer in timeline card/detail** — card shows first photo + non-interactive `+N` badge; modal stacks vertically with no zoom → add a swipeable full-screen pager with pinch-zoom reachable from the `+N` badge. (M · `TimelineCard.tsx:149-163,279-290`)
- **Edit timeline entry** — detail modal offers only Delete; `updateTimelineEntry` exists but is local-only → add author Edit affordance AND make `updateTimelineEntry` persist via `timelineService.updateEntry`. (M · `TimelineCard.tsx:224-372`; `AppContext.tsx:899-901`)
- **Comment editing** — comments can be added/deleted (persisted) but not edited → optional inline edit via `timelineService.updateComment`. (S · `TimelineCard.tsx:323-343`)
- **Add Photo via FAB** — on upload failure silently falls back to a local `file://` URI stored as the photo URL (broken for everyone else); no caption input → surface upload failures (retry/offline queue), don't persist unusable local URIs, optionally allow caption/activity-type. (M · `TimelineScreen.tsx:142-207`)
- **Un-mark milestone bypasses service layer** — UN-mark does an inline `supabase.from('milestones').update(...)` in the screen → add `milestonesService.clearAchieved(id)` and confirm RLS. (S · `GalleryScreen.tsx:188-208`)
- **Milestone empty state / per-child seeding** — Growth tab shows "0/0" + always-positive "doing great!" banner with no real data → add an empty state, seed milestone templates per child/age, don't show the positive banner when there's no data. (S · `GalleryScreen.tsx:86-92,407-475`)
- **Today stats & current mood** — sourced from `todayStats`; verify they derive from real date-scoped persisted entries for `selectedChild` and update on add/delete (not seed data). (S · `TimelineScreen.tsx:254-285`)
- **Notification tap doesn't deep-link** — only marks read and closes dropdown → navigate by notification type/target (entry, conversation, invoice); requires payloads to carry route/id. (M · `TimelineScreen.tsx:301-317,510-523`)

**Misleading copy (this area):**
- **"Live Updates" badge** — pulsing green dot implies realtime, but data only updates on pull-to-refresh/add/delete → add a Supabase realtime subscription for `timeline_entries` or remove/relabel the badge. (M · `TimelineScreen.tsx:432-437`)
- **Caregiver "note" presented as a personal message** — heuristically picks the first caregiver description >30 chars, else hardcodes `"{name} is having a great day!"`; role hardcoded "Lead Teacher" → back with a real per-day caregiver note field and the child's actual assigned teacher/title. (M · `TimelineScreen.tsx:113-121,337-351`)
- **Caregiver/teacher role label hardcoded** — `"Lead Teacher, {classroom}"` regardless of real role → show the caregiver's real title from profile. (S · `TimelineScreen.tsx:346`)
- **"Based on CDC/WHO guidelines"** — unsubstantiated unless the catalogue is actually CDC/WHO-derived → cite a real dataset or soften the copy. (S · `GalleryScreen.tsx:404-405`)

---

## Parent — Daily Report

- **Daily report not persisted/queryable** — computed on-the-fly from today's entries only; no saved record, no date picker, can't view past days → add a date selector + `daily_reports` model (or date-ranged timeline query) with UI date navigation. (L · `DailyReportScreen.tsx:29-53`)
- **Caregiver note attribution** — derives "the note" from the first caregiver entry with a description (heuristic, not a deliberate end-of-day note) → introduce an explicit daily caregiver-note field. (M · `DailyReportScreen.tsx:42-49,270-285`)
- **Thank caregiver — wrong-recipient fallback** — when no caregiver conversation matches, falls back to `conversations[0]` (could thank admin/another caregiver); message text is fixed; `thanked` state is local-only → resolve the correct caregiver conversation by child assignment, prompt to start one if none, allow a custom message, verify `sendMessage` persists. (M · `DailyReportScreen.tsx:129-150`)
- **Photos/Mood cards not drillable** — static non-interactive counts → make them tappable to the gallery/timeline filtered to that day. (M · `DailyReportScreen.tsx:196-208`)
- **Share daily report is thinner than PDF** — shares only narrative text → share the generated PDF or enrich the text to include stats/highlights. (S · `DailyReportScreen.tsx:55-58`)

**Misleading copy (this area):**
- **"Today's Story" AI narrative (sparkles)** — `generateDailyNarrative()` is a hardcoded template builder, no LLM → either wire a real summarization edge function or drop the sparkles/AI iconography. (M · `DailyReportScreen.tsx:225-243`; `AppContext.tsx:1186-1239`)
- **"Report Saved" shown on failure** — catch block claims success even when `printToFileAsync`/Sharing throws → show a real error and log to Sentry. (S · `DailyReportScreen.tsx:124-126`)

---

## Caregiver — Dashboard

- **Attendance status change not persisted** — status-badge cycle calls `updateAttendance()` which only sets React state → persist via `attendanceService` (upsert child+date row) with optimistic update + rollback. (M · `CaregiverDashboard.tsx:701-708`; `AppContext.tsx:1153-1157`)
- **Emergency Alert never broadcasts** — `handleEmergency` calls `addNotification` without a `childId`, so it's local-only (no DB row, no push to parents/admins) despite the "immediate alert to all parents and administrators" promise → build a real fan-out edge function/service for the classroom/daycare with delivery confirmation. (L · `CaregiverDashboard.tsx:274-299`; `AppContext.tsx:918-963`)
- **Incident parent-notify & witness dropped** — UI passes `parentNotified:true` and `witnessName`, but `addIncident` hardcodes `parent_notified_at:null`/`witness_name:null` and sends no real notification → pass through witness, set notified timestamp, trigger a real parent push. (M · `CaregiverDashboard.tsx:240-250`; `AppContext.tsx:1134-1146`)
- **Edit/delete a logged entry** — Recent Log rows are read-only → add tap/long-press edit/delete wired to `updateTimelineEntry`/`deleteTimelineEntry` (the former needs DB persistence first). (M · `CaregiverDashboard.tsx:450-459`)
- **Current Mood selector side effects** — shares `selectedMood` with the log modal, overrides the next quick-log default, and displays a last-tapped value (defaults "happy") not the child's real latest mood → decouple displayed mood from log mood and derive it from the most recent mood entry. (S · `CaregiverDashboard.tsx:405-426`)
- **Check-in/out is a single global boolean** — `isCheckedIn` is one global `useState(true)` always targeting `selectedChild`; switching children doesn't update the button → derive checked-in per-child from the attendance record. (M · `CaregiverDashboard.tsx:260-272`)
- **Demo-mode photo persistence** — returns raw local URIs in demo/no-daycare and on upload failure → ensure non-demo always uploads to Storage and surfaces real errors; keep demo URIs clearly demo-only. (S · `CaregiverDashboard.tsx:143-157`)

---

## Messages (shared)

- **Start new conversation** — list view has no compose button; no `createConversation` in context; `sendMessage` bails without an existing thread → add a compose FAB + participant picker + `createConversation` (conversations + participants insert with RLS) and navigate in. (L · `MessagesScreen.tsx:142-259`; `AppContext.tsx:50-58`)
- **Delete/edit a sent message** — no long-press, context menu, or actions; no `deleteMessage`/`editMessage` in context → add long-press soft-delete (and optional edit/copy) with service + RLS support. (M · `MessagesScreen.tsx:308-357`)
- **Photo message convention** — photos encoded as a magic `[photo:URL]` string in the text field; on upload failure sends an unusable local `file://` URI as "sent" → use a proper `type='image'`/`attachment_url` column and surface upload errors instead of sending broken URIs. (M · `MessagesScreen.tsx:333-341,366-387`)
- **Read receipts** — single/double checkmark driven only by local `msg.read`; no "delivered" state; unreachable color branch at line 350 → track per-recipient read state server-side (`read_at`/`message_reads`) and remove the dead ternary branch. (M · `MessagesScreen.tsx:346-352`)
- **lastMessage timestamp** — uses `conv.lastMessage.timestamp`; seeded/announcement convos have empty text + stale time → always derive `lastMessage` from the most recent real message; placeholder preview for empty convos. (S · `MessagesScreen.tsx:238`)
- **Typing/presence/in-thread search** — header is a static subtitle; search only filters the list, not messages in a thread → add Supabase Realtime presence/typing channels and in-thread search. (L · `MessagesScreen.tsx:282-285`)

**Dead code / fake copy (this area):**
- **Voice/video call UI is dead** — full call-modal styles defined but no button/Modal/handler renders them → remove the dead styles or implement real calling (Twilio/Agora). (L · `MessagesScreen.tsx:545-558`)
- **Fake "Today" date separator** — hardcoded "Today" at the top of every thread regardless of timestamps → group by calendar day and render real Today/Yesterday/date separators. (S · `MessagesScreen.tsx:302-306`)
- **"All messages are encrypted and private"** — stored as plaintext in Supabase (not E2E) → implement real encryption or change copy to a truthful statement. (M · `MessagesScreen.tsx:202-205`)

---

## Profile (shared)

- **Caregiver menu fallback ("Classroom"/"Attendance"/"Reports")** — falls through to a "requires server integration… future update" alert → build real classroom/attendance/report screens and remove the catch-all. (L · `ProfileScreen.tsx:155-157,211-214`)
- **Biometric Login toggle** — flips local `biometric` (default true), never persisted/read/enforced → integrate `expo-local-authentication`, persist in SecureStore, gate unlock. (M · `ProfileScreen.tsx:151-152,47`)
- **Offline Mode toggle** — flips local `offlineMode`, controls nothing → persist and actually drive the offline queue/sync; reflect real sync state. (M · `ProfileScreen.tsx:153-154,48`)
- **Notification preferences** — Smart/Meal/Nap/Photo/Milestone toggles persist to AsyncStorage only, not Supabase or the push backend → persist to a `notification_settings` table and have the push edge fn honor them. (M · `ProfileScreen.tsx:486-510`)
- **Privacy settings (Photo/Class Photos/Analytics)** — local + AsyncStorage only; analytics toggle doesn't gate Sentry; photo flags gate nothing → persist to Supabase, enforce photo consent server-side, gate analytics SDK init. (M · `ProfileScreen.tsx:511-539`)
- **Auto-Pay settings** — enable/day/save only write AsyncStorage and alert "Saved"; no Stripe schedule created → create a Stripe recurring/off-session charge via edge fn, persist config, run a scheduled charge job. (L · `ProfileScreen.tsx:344-392`)
- **Invite Family Member** — only alerts "Invitation Sent" and clears the form; no email, no record → create a `family_invite` record, send invite email, render the real network list with status/revoke. (L · `ProfileScreen.tsx:1048-1060`)
- **Add Authorized Pickup Person** — only alerts "Person Added"; not added to child or DB → insert `authorized_pickup` tied to the child, update context, support verify/delete. (M · `ProfileScreen.tsx:1089-1102`)
- **Family Network list** — always renders only the current user → load real members from Supabase with permission levels and edit/remove. (M · `ProfileScreen.tsx:250-268`)
- **Child Profile view (no edit)** — read-only DOB/age/classroom/pediatrician/allergies/contacts → add edit + add/remove emergency contacts persisted to Supabase. (M · `ProfileScreen.tsx:231-249`)
- **Health & Allergies view (no edit)** — read-only → add/remove allergies + pediatrician edit persisted to child record. (M · `ProfileScreen.tsx:292-306`)
- **Download Receipt** — shares a plain-text string, not a real receipt → generate a PDF or fetch the Stripe-hosted receipt URL. (M · `ProfileScreen.tsx:451-457`)
- **Download My Data category toggles are dead** — Timeline/Photos/Messages/Reports switches never reach the export edge fn (invoke passes no body) → pass selected categories in the invoke body and honor them server-side. (S · `ProfileScreen.tsx:674-703`)
- **Lesson Plans (caregiver) read-only** — no create/edit or mark-complete → add authoring + activity-complete actions persisted to Supabase. (M · `ProfileScreen.tsx:797-831`)
- **Incident Reports (parent) read-only** — no acknowledge/sign-off → add parent acknowledgement persisted; optional caregiver create flow. (M · `ProfileScreen.tsx:832-868`)
- **Language selection** — local + AsyncStorage only; no i18n layer so strings never change → add i18n (i18next/expo-localization), translate, persist locale, apply app-wide. (L · `ProfileScreen.tsx:540-558`)
- **Translation Settings** — toggle/target stored locally; no message translation anywhere → integrate a translation edge fn and apply in messaging when enabled. (L · `ProfileScreen.tsx:559-591`)
- **"End-to-End Encrypted" / COPPA badge** — asserts E2E for all messages/data (not true) → implement E2E or correct the copy. (M · `ProfileScreen.tsx:482-483,978-981`)

---

## Admin

- **Classrooms management** — `screen:null` → "Coming Soon" alert → build a Classrooms CRUD screen + `classrooms` table/service, register in `AdminNavigator`. (L · `AdminDashboard.tsx:31`)
- **Calendar (events & closures)** — "Coming Soon" alert → build an events/closures screen persisted to `calendar_events`, surface to parents/caregivers. (L · `AdminDashboard.tsx:32`)
- **Send Announcement** — "Coming Soon" alert → build a composer writing to an announcements table with push fan-out via the PushNotification edge fn. (L · `AdminDashboard.tsx:38`)
- **Generate Report** — "Coming Soon" alert → implement attendance/enrollment/activity report generation with PDF/CSV export from real data. (L · `AdminDashboard.tsx:39`)
- **Staff invite writes to non-existent `invitations` table** — insert fails (42P01) and shows "invitation system not set up" → reuse the existing `invite_codes` flow / `create_daycare`-style RPC to generate a caregiver/admin code, and actually deliver it (email). (L · `ManageStaffScreen.tsx:98-128`)
- **Staff invite "email sent" is fake** — alert claims an email was sent though only a row would be written → send a real invite email and only claim "sent" after delivery. (M · `ManageStaffScreen.tsx:108-111`)
- **Edit staff role / remove staff** — staff cards are plain Views → add promote/demote (`profiles.role`), classroom assign, remove/deactivate with RLS. (M · `ManageStaffScreen.tsx:175-194`)
- **Pending invites not listed** — only existing profiles shown → list pending invites with revoke/resend. (M · `ManageStaffScreen.tsx:161-195`)
- **Staff classroom always empty** — `fetchStaff` never selects a classroom field → join/select assigned classroom once classrooms exist, else remove the unused field. (S · `ManageStaffScreen.tsx:55-60,185`)
- **Edit/view child detail** — tapping a child only calls `selectChild`; `childrenService.updateChild` never called → add a child detail/edit screen wired to `updateChild` + `refreshData`. (M · `ManageChildrenScreen.tsx:112`)
- **Delete/unenroll child** — no affordance; `childrenService.deleteChild` unwired → add a confirmed delete/unenroll action. (S · `ManageChildrenScreen.tsx:111-124`)
- **Add Child form incomplete** — only first/last/DOB; classroom/medical/avatar hardcoded null, allergies never collected → extend the form to capture all fields. (M · `ManageChildrenScreen.tsx:43-51`)
- **DOB free-text, blank defaults to today** — no validation, missing DOB silently becomes today's date → use a date picker, validate, require or null-store. (S · `ManageChildrenScreen.tsx:47,153-160`)
- **Invite code expiry/revoke** — codes listed/copyable but no revoke/expire; expired codes hidden → add revoke/delete (or `expires_at=now()`) with RLS. (S · `InviteCodesScreen.tsx:248-292`)
- **Invite code roles limited to parent/caregiver** — no family/admin option though both are needed → add family (and possibly admin) options mapping to `redeem_invite_code`/COPPA family gate. (S · `InviteCodesScreen.tsx:33,174-189`)
- **Admin attendance stats scope** — counts derived from possibly-own-scope context arrays; absent computed by subtraction → fetch daycare-wide counts scoped to `daycare_id` and compute absent explicitly. (M · `AdminDashboard.tsx:19-23`)
- **Period selector dead state** — `selectedPeriod`/`setSelectedPeriod` declared but never rendered → render a working today/week/month toggle that re-scopes queries, or remove the dead state. (M · `AdminDashboard.tsx:16`)
- **Daycare name placeholder** — shows literal "Your Daycare" when a daycare exists → use the real `daycare?.name` (as `InviteCodesScreen` does). (S · `AdminDashboard.tsx:18`)
- **Settings → 'Profile' route may be unregistered** — silently no-ops if not in the Admin stack → verify/register the route. (S · `AdminDashboard.tsx:77`)

---

## Payments

- **No cancel/downgrade/manage subscription** — only upgrade/start; no billing-portal path; selecting "free" early-returns → add a "Manage Subscription" action opening the Stripe Customer Portal (billing-portal edge fn) and handle downgrades. (M · `SubscriptionScreen.tsx:106-227`)
- **No refresh after checkout** — returns from Stripe checkout but never re-fetches status, so the new plan isn't reflected until remount → re-run `getSubscriptionStatus` on focus/AppState resume or via an `onSuccess` callback. (M · `SubscriptionScreen.tsx:129-151`)
- **Set default payment method** — "Default" badge shown but no action to change it → add "Make Default" calling an edge fn to set `invoice_settings.default_payment_method`. (M · `PaymentMethodsScreen.tsx:233-259`)
- **List/add/remove payment methods depend on undeployed edge fns** — `list-payment-methods`, `create-setup-intent`, `detach-payment-method` degrade to empty/alert when missing; add is native-only (web stub) → deploy + verify these edge functions; provide a web equivalent for adding cards; guard against removing the default method. (L · `PaymentMethodsScreen.tsx:50-207`)
- **Plan prices hardcoded** — `daycarePlans`/`parentPlans` arrays embed `$29/$59/$99/$4.99`; may drift from `STRIPE_PRICES`/dashboard → source plan metadata from one source of truth (config.plans or a `list-plans` edge fn) so UI matches the charge. (M · `SubscriptionScreen.tsx:25-104`)
- **Plan card double-onPress / decorative selection** — outer card sets `selectedPlan` (highlight only), inner button subscribes; nested touchables cause ambiguous taps → tie selection to one confirm action or remove the redundant state. (S · `SubscriptionScreen.tsx:169-223`)
- **Parent "free" button does nothing** — early-returns for `free`/current with no downgrade path → trigger downgrade/cancel via billing portal when premium, else label as current and disable. (S · `SubscriptionScreen.tsx:130`)
- **InvoiceDetailScreen is dead code** — documented UNUSED, superseded by ProfileScreen's inline invoice view; its "Pay"/success/receipt branches are non-functional stubs → delete the file, or revive it as the single canonical invoice screen with a real Stripe payment + post-payment refresh. (S · `InvoiceDetailScreen.tsx:1-232`)

---

## Auth & Legal

- **Privacy Policy / Terms in-app screens not wired** — fully written but never imported into navigation; SignUp opens external (possibly unhosted) URLs instead → register routes/modals, link from SignUp, Consent, and Profile; pass `onClose`. (S · `PrivacyPolicyScreen.tsx`; `TermsOfServiceScreen.tsx`; `SignUpScreen.tsx:173-175`)
- **COPPA consent not per-child, names no child** — `AppNavigator` passes `childName=""`; consent recorded once as a single `profile.coppa_consent_at` → pass real child name(s), record consent per `child_id` with timestamp/parent name/policy version, gate per-child data collection. (M · `AppNavigator.tsx:256-270`; `ConsentScreen.tsx:34-37,132`)
- **Consent lacks audit trail** — only writes `coppa_consent_at`; no policy version/text hash/signed name/identity proof → persist a dedicated `consents` audit record for legal defensibility. (M · `ConsentScreen.tsx:40-53`)
- **Consent "Your Rights" asserts unverified features** — static bullet lists imply working export/deletion/withdraw → ensure each asserted right is actually exercisable; build any missing flows. (M · `ConsentScreen.tsx:73-119`)
- **EmailVerification cross-device confirmation not detected** — polls `getUser()` but never refreshes the session, so confirming on another device leaves the user stuck → periodically call `refreshSession()`, bound the polling, ensure the back-to-sign-in path recovers. (M · `EmailVerificationScreen.tsx:27-46`)
- **Resend cooldown local-only** — 30s cooldown resets on remount, letting users spam resend into rate limits → persist last-resend timestamp (AsyncStorage), show a countdown, handle the rate-limit error. (S · `EmailVerificationScreen.tsx:48-68`)
- **ResetPassword no recovery-session guard** — assumes a valid recovery session; expired links show raw errors → verify the recovery session on mount, show a clear "link expired — request new" state routing back to ForgotPassword, map errors to friendly copy. (S · `ResetPasswordScreen.tsx:24-42`)
- **ResetPassword weaker policy than SignUp** — requires only length ≥8 vs SignUp's uppercase+number → reuse `signUpSchema`'s complexity validator. (S · `ResetPasswordScreen.tsx:22,100-105`)
- **DaycareOnboarding classroom inserts** — `classroomSchema` imported but unused; capacity hardcoded 20; per-row failures alert but DON'T stop, advancing to "All Set!" with partial data → validate each row, let admin set capacity, batch-insert or block on failure. (S · `DaycareOnboardingScreen.tsx:11,69-96`)
- **DaycareOnboarding "Done" relies on implicit nav switch** — step 3 spinner waits for `profile.daycare_id`; a refresh race can strand the user forever → add an explicit "Go to Dashboard" button and/or a timeout fallback that re-checks the profile. (S · `DaycareOnboardingScreen.tsx:273-281`)
- **"Join Demo Daycare (Pilot)" exposed to all production users** — any parent/caregiver without a `daycare_id` can drop into shared "Sunshine Academy" sample data → gate behind a build/pilot flag and confirm sample children aren't commingled with real tenants. (M · `InviteCodeScreen.tsx:103-127`)

**Misleading copy (this area):**
- **Login "End-to-End Encrypted" badge** — Supabase is TLS+RLS+at-rest, not E2E → change to an accurate claim (e.g. "Encrypted in Transit") or implement real E2E. (S · `LoginScreen.tsx:177-180`)
- **Onboarding "AI-generated narratives"** — markets AI daily reports on the first screen; daily report is templated, not AI → implement a real LLM summarizer or soften the copy. (L · `LoginScreen.tsx:25`)
- **"14-Day Free Trial — No credit card required"** — decorative; `createDaycare` sets no `trial_ends_at`/subscription state, no enforcement → implement a real trial (set `trial_ends_at`, gate features on expiry, integrate Stripe) or remove the promise. (L · `DaycareOnboardingScreen.tsx:171-178`)
- **Legal screens "Last updated: February 2026" + static text** — hardcoded, no versioning; references "Profile > Privacy > Data Management" that must exist → add a policy-version constant tied to the consent record and confirm the referenced data-management flow works. (S · `PrivacyPolicyScreen.tsx:30`; `TermsOfServiceScreen.tsx:29`)

---

## Context & Data (AppContext / services)

- **Edit/add/delete child profile** — context exposes only `children`/`selectedChild`/`selectChild`; no `addChild`/`updateChild`/`deleteChild` → add CRUD context methods persisted to `children` (+ parent_children link) with optimistic updates. (L · `AppContext.tsx:36-39`)
- **Create a new conversation** — no `createConversation`; `sendMessage` bails without an active conversation → add `createConversation(participantIds, type, title?)` that inserts conversation + members and sets it active. (M · `AppContext.tsx:50-58,975-978`)
- **Learning plans / milestones / calendar are read-only** — fetched but no add/edit/delete context methods despite `milestonesService`/`calendarService` being imported → add author/update/delete methods wired through the services with optimistic state. (L · `AppContext.tsx:93-98,419-486`)
- **Emergency contacts & authorized pickups not fetched** — hardcoded to `[]` when mapping Supabase children; only fake sample children have values → fetch from DB, map into `Child`, add persisted add/edit/delete handlers. (M · `AppContext.tsx:232-233`)
- **Pediatrician not mapped** — never set on fetched children (only fakes have it) → select/map the pediatrician column and expose an edit/persist path. (S · `AppContext.tsx:224-234`)
- **Notifications not fetched** — `notifications` starts empty; the big fetch effect never queries the table though `addNotification` writes rows → add a `select` (user_id = profile.id) plus realtime subscription. (M · `AppContext.tsx:178-513`)
- **Incidents not fetched** — `incidents` starts empty; fetch effect never queries despite `addIncident` writing rows → fetch incidents scoped by child/daycare. (M · `AppContext.tsx:178-513`)
- **`markNotificationRead`/`markAllNotificationsRead` not persisted** — local state only → write the read column for the id(s) with optimistic update. (S · `AppContext.tsx:1089-1097`)
- **`updateTimelineEntry` not persisted** — local-only; never calls `timelineService.updateEntry` (which exists) → call the service after the optimistic update. (S · `AppContext.tsx:899-901`)
- **`updateAttendance` not persisted** — local-only unlike `toggleCheckIn` → persist via `attendanceService` for child/date. (S · `AppContext.tsx:1153-1157`)
- **Add/delete comment temp id not reconciled** — `addComment` uses `cm{Date.now()}` and never swaps in the real DB id, so deletes target a fake id → return the inserted id from `timelineService.addComment` and reconcile. (S · `AppContext.tsx:829-857,904-915`)
- **Reaction persist fire-and-forget** — `toggleReaction` only console.warns on failure, no rollback → revert the optimistic reaction (or refetch) on persist failure. (S · `AppContext.tsx:860-886`)
- **Message `read` flag hardcoded false on load** — all fetched messages mapped `read:false`; `unreadCount` derived from it → join read-receipts at fetch time and compute per-message read. (M · `AppContext.tsx:329,364,368`)
- **Conversation `unreadCount` hardcoded 0 on load** — only increments via realtime in-session; resets on reload → compute from DB read state at fetch. (M · `AppContext.tsx:370`)
- **`addNotification` only child-scoped** — DB persist + push only when `notif.childId` set; daycare-wide/billing notifications are local-only → support non-child-scoped notifications with proper recipient resolution. (M · `AppContext.tsx:918-963`)
- **Realtime messages not server-filtered** — subscribes to ALL `messages` INSERTs, filters client-side; leaks cross-tenant events if RLS is permissive → add a server-side filter (conversation_id list/daycare) like the timeline subscription. (S · `AppContext.tsx:593-648`)
- **Invoices read-only / parent-only** — no create-invoice path; admins/caregivers never load invoices → add admin invoice create/manage methods and fetch invoices for admin via the create-invoice edge fn. (M · `AppContext.tsx:89-91,377-397`)
- **`todayStats` nap/mood heuristics** — naps inferred via `|| (napEntries.length>0?1:0)`, duration falls back to "In progress"; mood defaults "happy" when none → track real nap start/end sessions and default mood to neutral/absent. (M · `AppContext.tsx:772-788`)

**Demo/fake data leakage (this area):**
- **Hardcoded 8-child classroom roster** — fake children (Zain, Emma, Noah…) used as caregiver/admin roster when no Supabase children fetched → remove the fabricated array; roster must come from the `children` query; gate demo fallback to true demo mode. (S · `AppContext.tsx:114-123`)
- **Sample users/children seed surfaced as real** — fake `parentUser`/`caregiverUser`/`layla`/`adam` used via `allChildren`/`currentUser` fallback when `profile` is null; the only source for contacts/pickups/pediatrician → isolate demo data to demo/offline mode; never leak into authenticated sessions. (S · `sampleData.ts:4-57`)
- **Demo `login(role)` bypasses real auth** — sets local state + AsyncStorage `littlejourney_auth`, appears logged-in with no Supabase session → gate to demo builds only; production auth must go through AuthContext/Supabase. (M · `AppContext.tsx:743-748`)
- **AsyncStorage cache not namespaced per user** — single global key restored before/independent of Supabase fetch; switching accounts can load the previous user's data → namespace by user id, clear on logout, treat as offline fallback only. (M · `AppContext.tsx:1277-1333`)
- **`isCheckedIn` hardcoded `true`** — global (not per-child), shows checked-in before any fetch → derive per-child from fetched attendance. (M · `AppContext.tsx:140`)
- **`generateDailyNarrative` / `generateHighlights` are templated, presented as generated** — canned cheerleader phrases + arbitrary slices → back with real logic/summarization or clearly label as templated; only show phrases supported by data. (M / S · `AppContext.tsx:1186-1271`)
- **`milestonesService`/`calendarService` imported but unused for writes** — milestones/calendar fetched via inline queries → wire writes through the services or remove the unused imports. (S · `AppContext.tsx:18-19`)

---

## Suggested priority order

**P0 — Correctness & trust (do first; small effort, high impact)**
1. Remove/correct all misleading claims: "End-to-End Encrypted" (Login, Profile, Messages), "AI-generated narratives" + sparkles, "Based on CDC/WHO", "Live Updates" badge, "14-Day Free Trial". (mostly S)
2. Fix the "Report Saved" success-on-failure alert in Daily Report. (S)
3. Fix the Thank-caregiver wrong-recipient `conversations[0]` fallback. (M)
4. Stop persisting unusable local `file://` URIs on photo/message upload failure (Timeline FAB, CaregiverDashboard, Messages). (S–M)
5. Fix admin "Daycare name" placeholder and the DOB-defaults-to-today bug. (S)

**P1 — Make existing UI actually persist (the local-only epidemic)**
6. Persist `updateTimelineEntry`, `updateAttendance`, `markNotificationRead`/`All`, reconcile comment temp ids, reaction rollback. (S each)
7. Persist caregiver attendance status change and per-child check-in/out state. (M)
8. Fetch notifications & incidents from Supabase on startup; compute message `read`/`unreadCount` from DB. (M each)
9. Namespace + clear the AsyncStorage cache per user; gate demo login/roster/sample data to demo builds only. (M)
10. Honor notification/privacy/auto-related preferences in the backend (or stop claiming they take effect). (M)

**P2 — Core missing features users expect**
11. Start a new conversation (`createConversation` + compose UI). (L)
12. Emergency-alert and incident parent notification fan-out (real push). (L / M)
13. Child edit/add/delete + emergency contacts/authorized pickups/pediatrician fetch & edit. (L / M)
14. Subscription management (cancel/downgrade/billing portal) + post-checkout refresh; deploy & verify payment-method edge functions; set-default card. (M–L)
15. Admin: real Staff invite (via `invite_codes`/RPC + email), staff edit/remove, child detail/edit. (M–L)

**P3 — Build out the "Coming Soon" admin surfaces & richer UX**
16. Classrooms CRUD, Calendar/events & closures, Send Announcement, Generate Report. (L each)
17. Daily report persistence + date navigation; multi-photo viewer; download-to-device; favorites; device-calendar/reminders. (M–L)
18. Real trial enforcement; auto-pay scheduled charges; receipt/data-export PDFs. (L)

**P4 — Legal/compliance hardening & polish**
19. Wire in-app Privacy/Terms screens; per-child COPPA consent with full audit trail; ensure asserted data rights (export/delete/withdraw) actually work; policy versioning. (S–M)
20. Auth flow robustness: ResetPassword session guard + matching password policy, EmailVerification cross-device refresh + persisted resend cooldown, onboarding done-state fallback. (S each)
21. i18n + message translation; real nap-session tracking; server-side realtime message filtering; remove dead code (call UI styles, `InvoiceDetailScreen`, unused imports/state). (S–L)

---

### Relevant file paths
- `src/screens/parent/GalleryScreen.tsx`, `src/screens/parent/TimelineScreen.tsx`, `src/components/TimelineCard.tsx`
- `src/screens/parent/DailyReportScreen.tsx`
- `src/screens/caregiver/CaregiverDashboard.tsx`
- `src/screens/shared/MessagesScreen.tsx`, `src/screens/shared/ProfileScreen.tsx`
- `src/screens/admin/AdminDashboard.tsx`, `ManageChildrenScreen.tsx`, `ManageStaffScreen.tsx`, `InviteCodesScreen.tsx`
- `src/screens/payments/SubscriptionScreen.tsx`, `PaymentMethodsScreen.tsx`, `InvoiceDetailScreen.tsx`
- `src/screens/auth/*` (`LoginScreen`, `SignUpScreen`, `EmailVerificationScreen`, `ResetPasswordScreen`, `DaycareOnboardingScreen`, `InviteCodeScreen`), `src/screens/legal/*` (`ConsentScreen`, `PrivacyPolicyScreen`, `TermsOfServiceScreen`)
- `src/context/AppContext.tsx`, `src/data/sampleData.ts`, `src/navigation/AppNavigator.tsx`
---

## Appendix — Live browser findings (Playwright, running app)

Observed by actually driving the app in a browser (demo mode, dev server). These
complement the source audit above.

### Boot / infrastructure
- **FIXED during exploration:** `src/lib/supabase.ts` called `createClient('')` when
  Supabase env was empty → threw "supabaseUrl is required" at module load and **crashed
  the app on the splash screen**. Patched with a placeholder-URL fallback so it degrades
  gracefully. (This was blocking demo mode and any unconfigured boot.)
- **Realtime WebSockets retry endlessly with no backoff** when the backend is unreachable
  — the console error count climbs continuously (19+ in a short session). Disable/snooze
  realtime when unconfigured or add exponential backoff.
- **AppContext fires Supabase REST queries even in demo mode** (`/rest/v1/children` etc.),
  producing console errors. Demo/offline mode should short-circuit network calls.
- **Demo session is not persisted** — a hard reload or direct-URL navigation drops the
  user back to Login (in-memory only).
- **Static `build:web` export can't use demo mode** (`__DEV__=false`), so the production
  web preview can only reach Login unless real Supabase env is provided at build time.

### Demo data quality (visible in UI)
- **Child name renders "Unknown"** throughout the parent demo: Timeline header child card,
  Daily Report header (" 's Day" with empty avatar), and the caregiver note
  (`" is having a great day!"` — name missing before "is having"). The demo's selected
  child has no `firstName`.
- **Caregiver/Admin demo seeds no children** → "No Children Assigned" empty dashboards;
  only the parent demo gets (partial, name-less) sample data.

### Accessibility
- **Tab-bar accessibility labels stutter/duplicate**: e.g. "Dashboard tab Dashboard tab
  Dashboard". Each tab's label is concatenated multiple times.

### Local environment note
- A local (gitignored) `.env` contains a **dead Supabase project URL**
  (`onlzwqaetbvucikqpqdb...`) that gets baked into `build:web`, so the static preview
  authenticates against nothing. Replace with a live project or rely on demo mode.
