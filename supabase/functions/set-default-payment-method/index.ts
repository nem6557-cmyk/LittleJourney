// Supabase Edge Function: make a saved card the default for invoices/subscriptions.

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

    await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: paymentMethodId } });
    return json({ success: true });
  } catch (err) {
    return errorResponse('set-default-payment-method', err);
  }
});
