// Supabase Edge Function: Stripe Connect (Express) onboarding for a daycare, so it
// can receive tuition. Admin-only; the daycare comes from the caller's profile.
//
//   { action: 'status' }                → current onboarding state (no side effects)
//   { action: 'onboard', returnUrl? }   → creates the account if needed + returns a link
//   { action: 'dashboard' }             → Express dashboard login link (after onboarding)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { admin, requireAdmin, requireCaller } from '../_shared/auth.ts';
import { errorResponse, HttpError, json, preflight, readJson } from '../_shared/http.ts';
import { safeReturnUrl, stripe } from '../_shared/stripe.ts';

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const caller = await requireCaller(req);
    const daycareId = requireAdmin(caller);
    const body = await readJson<{ action?: string; returnUrl?: string }>(req);
    const action = body.action ?? 'onboard';

    const { data: daycare } = await admin
      .from('daycares')
      .select('stripe_account_id, name, email')
      .eq('id', daycareId)
      .single();
    if (!daycare) throw new HttpError(404, 'Daycare not found.');

    let accountId: string | null = daycare.stripe_account_id ?? null;

    if (action === 'status') {
      if (!accountId) return json({ accountId: null, onboardingComplete: false, chargesEnabled: false, payoutsEnabled: false });
      const acct = await stripe.accounts.retrieve(accountId);
      const complete = !!(acct.charges_enabled && acct.payouts_enabled && acct.details_submitted);
      // Heal the cached flag if the webhook was missed.
      await admin.from('daycares').update({ stripe_onboarding_complete: complete }).eq('id', daycareId);
      return json({
        accountId,
        onboardingComplete: complete,
        chargesEnabled: !!acct.charges_enabled,
        payoutsEnabled: !!acct.payouts_enabled,
      });
    }

    if (action === 'dashboard') {
      if (!accountId) throw new HttpError(404, 'Payments are not set up yet.');
      const link = await stripe.accounts.createLoginLink(accountId);
      return json({ url: link.url });
    }

    if (action !== 'onboard') throw new HttpError(400, 'Unknown action.');

    if (!accountId) {
      const account = await stripe.accounts.create(
        {
          type: 'express',
          country: 'US',
          email: daycare.email || undefined,
          business_type: 'company',
          company: { name: daycare.name },
          capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
          metadata: { daycare_id: daycareId },
        },
        { idempotencyKey: `connect-${daycareId}` },
      );
      accountId = account.id;
      await admin.from('daycares').update({ stripe_account_id: accountId }).eq('id', daycareId);
    }

    const returnUrl = safeReturnUrl(body.returnUrl, 'littlejourney://connect-success');
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: safeReturnUrl(body.returnUrl, 'littlejourney://connect-refresh'),
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return json({ accountId, onboardingUrl: link.url });
  } catch (err) {
    return errorResponse('create-connect', err);
  }
});
