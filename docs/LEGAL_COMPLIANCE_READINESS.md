# LittleJourney Legal Compliance Readiness

Last updated: July 2026

This is an engineering readiness checklist, not legal advice. A qualified
attorney and the daycare/operator must approve the final privacy policy, terms,
consent language, retention policy, security program, vendor list, and app-store
privacy disclosures before production launch.

Official reference anchors:

- FTC COPPA six-step plan: https://www.ftc.gov/business-guidance/resources/childrens-online-privacy-protection-rule-six-step-compliance-plan-your-business
- FTC COPPA Rule amendments, effective June 23, 2025, with most compliance obligations due April 22, 2026: https://www.federalregister.gov/documents/2025/04/22/2025-05904/childrens-online-privacy-protection-rule
- FTC COPPA amendments summary: https://www.ftc.gov/news-events/news/press-releases/2025/01/ftc-finalizes-changes-childrens-privacy-rule-limiting-companies-ability-monetize-kids-data
- U.S. Department of Education FERPA guidance: https://studentprivacy.ed.gov/ferpa

## Status

Engineering status: partially ready.

Production release status: blocked until external account setup, production
Supabase migration/advisor checks, hosted legal pages, app-store privacy forms,
and legal/operator signoff are complete.

## COPPA Readiness

Current app controls:

- Parent/family data access is gated behind a consent flow for non-demo accounts.
- Consent audit rows include parent, optional child, signed name, policy version, timestamp, and consent value.
- The app copy says child data is entered by parents, guardians, or authorized caregivers, not by children.
- Data deletion and data export flows exist through Supabase Edge Functions.
- Sentry scrubbing removes sensitive request/user fields before events are sent.
- Store listing copy says data is not sold and not used for advertising.

Production checklist:

- Counsel approves the hosted privacy policy at `https://littlejourney.app/privacy.html`.
- Counsel approves the hosted terms at `https://littlejourney.app/terms.html`.
- Direct notice to parents explains what data is collected, how it is used, third-party processors, review/deletion rights, and contact information.
- Verifiable parental consent method is approved for the production business model.
- Parents can review collected child data.
- Parents can request correction, deletion, and refusal of further collection/use.
- Deletion/export requests are operationally monitored and fulfilled within the published timeline.
- Data retention schedule states what is kept, why, for how long, and how it is deleted.
- Targeted advertising and sale/sharing of child data remain disabled. If that changes, COPPA amendments require separate consent for certain third-party disclosures/targeted advertising uses.
- Push, analytics, crash reporting, payments, infrastructure, and support vendors are listed accurately in the privacy policy and store disclosures.
- App-store privacy labels/data safety forms match the real SDKs and backend behavior.

## FERPA Readiness

LittleJourney may handle records that a daycare/school treats as education
records. The app should support the operator's FERPA obligations instead of
claiming independent blanket compliance.

Current app controls:

- Role-based app access separates admin, caregiver, parent, and family behavior.
- Supabase RLS policies scope data by daycare, child, parent-child links, and staff role.
- Invites link users to daycare/child records instead of exposing open registration data.
- Messages, photos, reports, attendance, and child profile data are stored in daycare-scoped tables.

Production checklist:

- Operator confirms whether each daycare is a FERPA-covered educational agency/institution.
- Operator agreement defines LittleJourney as a service provider/school official only where appropriate.
- Access is limited to users with a legitimate educational interest.
- Daycare admins are trained to remove staff/family access promptly.
- Redisclosure restrictions are covered in contracts and privacy terms.
- Audit process exists for access complaints, correction requests, and deletion requests.
- Demo/app-review data uses synthetic records only.

## State Privacy And Childcare Operations

Production checklist:

- Counsel reviews state-specific childcare privacy, health, biometric, photo/video, breach notification, and consumer privacy requirements for launch states.
- Incident/medical/allergy fields are reviewed for health-data sensitivity.
- Photo consent and class-photo sharing settings are enforceable in policy and product.
- Emergency-contact and authorized-pickup data has a documented business purpose and retention period.
- Staff background-check, licensing, and mandated-reporting obligations remain outside the app unless explicitly implemented and reviewed.

## App Store Privacy Forms

Apple privacy labels and Google Play Data Safety should disclose, at minimum,
the categories actually collected or processed:

- Name and email.
- Child profile information.
- Photos and messages.
- Activity, attendance, milestone, health/allergy, and emergency-contact data.
- Payment-related identifiers handled by Stripe.
- Device/app diagnostics handled by Sentry.
- Push notification tokens.

Declare tracking as disabled unless a future SDK or business process performs
cross-app/site tracking under Apple/Google definitions.

## Launch Gate

Do not mark legal/compliance ready until all of these are complete:

- Hosted Privacy Policy and Terms are live.
- Counsel/operator has signed off on COPPA, FERPA, state privacy, and app-store disclosures.
- Production Supabase RLS/advisor checks pass.
- Data export and deletion are smoke-tested in production with throwaway data.
- Vendor list and subprocessors are accurate.
- No in-app or store copy claims "compliant" without approved legal language.
