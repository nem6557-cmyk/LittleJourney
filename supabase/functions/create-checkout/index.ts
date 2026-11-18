// Supabase Edge Function: create a Stripe Checkout Session for a DAYCARE plan.
//
// Security notes
//  - Admin-only; the daycare comes from the caller's profile, never the request.
//  - The Stripe customer is the one stored on the caller's profile.
//  - returnUrl is allow-listed (no open redirect).
//  - A daycare that already has a live subscription is sent to the billing
//    portal instead of buying a second one; a daycare that has ever had a Stripe
//    subscription never gets another free trial.
// Parent-level "premium" subscriptions are intentionally not offered: they were
// never enforced in the app and digital upgrades sold inside iOS/Android apps
// must use platform billing.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { admin, requireAdmin, requireCaller } from '../_shared/auth.ts';
import { errorResponse, HttpError, json, preflight, readJson } from '../_shared/http.ts';
import { getOrCreateCustomer, priceIdForPlan, safeReturnUrl, stripe } from '../_shared/stripe.ts';

const MIN_TRIAL_SECONDS = 49 * 60 * 60; // Stripe requires trial_end >= 48h away
const LIVE_STATUSES = ['active', 'trialing', 'past_due'];

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const caller = await requireCaller(req);
    const daycareId = requireAdmin(caller);
    const body = await readJson<{ plan?: string; returnUrl?: string }>(req);

    const plan = String(body.plan ?? '');
    if (!['starter', 'professional', 'enterprise'].includes(plan)) {
      throw new HttpError(400, 'Invalid plan.');
    }
    const priceId = priceIdForPlan(plan);

    const { data: existing } = await admin
      .from('subscriptions')
      .select('stripe_subscription_id, status, current_period_end')
      .eq('daycare_id', daycareId)
      .maybeSingle();

    if (existing?.stripe_subscription_id && LIVE_STATUSES.includes(existing.status)) {
      throw new HttpError(409, 'Your daycare already has a subscription. Use "Manage billing" to change plans.');
    }

    // Honour the remaining in-app trial exactly once, and only before the daycare
    // has ever subscribed through Stripe.
    let trialEnd: number | undefined;
    if (!existing?.stripe_subscription_id && existing?.status === 'trialing' && existing.current_period_end) {
      const end = Math.floor(new Date(existing.current_period_end).getTime() / 1000);
      if (end - Math.floor(Date.now() / 1000) >= MIN_TRIAL_SECONDS) trialEnd = end;
    }

    const customerId = await getOrCreateCustomer(caller);
    const metadata = { daycare_id: daycareId, plan_tier: plan, supabase_uid: caller.user.id };

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: daycareId,
      payment_method_collection: 'always',
      subscription_data: { trial_end: trialEnd, metadata },
      metadata,
      success_url: safeReturnUrl(body.returnUrl, 'littlejourney://payment-success'),
      cancel_url: safeReturnUrl(body.returnUrl, 'littlejourney://payment-cancel'),
    });

    return json({ sessionId: session.id, url: session.url });
  } catch (err) {
    return errorResponse('create-checkout', err);
  }
});
