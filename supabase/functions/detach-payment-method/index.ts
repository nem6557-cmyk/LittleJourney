// Supabase Edge Function: remove a saved card.
// Ownership is checked against the customer stored on the caller's profile, and
// the last card is protected while a subscription is still billing it.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { requireCaller } from '../_shared/auth.ts';
import { errorResponse, HttpError, json, preflight, readJson } from '../_shared/http.ts';
import { existingCustomerId, stripe } from '../_shared/stripe.ts';

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const caller = await requireCaller(req);
    const { paymentMethodId } = await readJson<{ paymentMethodId?: string }>(req);
    if (!paymentMethodId || typeof paymentMethodId !== 'string' || !paymentMethodId.startsWith('pm_')) {
      throw new HttpError(400, 'paymentMethodId is required.');
    }

    const customerId = existingCustomerId(caller);
    if (!customerId) throw new HttpError(404, 'No payment methods on file.');

    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (pm.customer !== customerId) throw new HttpError(403, 'That payment method is not yours.');

    const [cards, subs] = await Promise.all([
      stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 20 }),
      stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 20 }),
    ]);
    const billing = subs.data.some((s) => ['active', 'trialing', 'past_due'].includes(s.status));
    if (billing && cards.data.length <= 1) {
      throw new HttpError(409, 'Add another card before removing your only one — your subscription still needs it.');
    }

    await stripe.paymentMethods.detach(paymentMethodId);
    return json({ success: true });
  } catch (err) {
    return errorResponse('detach-payment-method', err);
  }
});
