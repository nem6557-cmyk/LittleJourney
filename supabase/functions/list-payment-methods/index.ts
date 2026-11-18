// Supabase Edge Function: list the caller's saved cards (minimal fields only).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { requireCaller } from '../_shared/auth.ts';
import { errorResponse, json, preflight } from '../_shared/http.ts';
import { existingCustomerId, stripe } from '../_shared/stripe.ts';

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const caller = await requireCaller(req);
    const customerId = existingCustomerId(caller);
    if (!customerId) return json({ paymentMethods: [], defaultPaymentMethodId: null });

    const [methods, customer] = await Promise.all([
      stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 20 }),
      stripe.customers.retrieve(customerId),
    ]);

    let defaultPaymentMethodId: string | null = null;
    if (!('deleted' in customer && customer.deleted)) {
      const dpm = (customer as { invoice_settings?: { default_payment_method?: unknown } }).invoice_settings
        ?.default_payment_method;
      if (typeof dpm === 'string') defaultPaymentMethodId = dpm;
      else if (dpm && typeof dpm === 'object' && 'id' in dpm) defaultPaymentMethodId = (dpm as { id: string }).id;
    }

    // Only what the UI needs — never return the full Stripe object.
    const paymentMethods = methods.data.map((pm) => ({
      id: pm.id,
      card: {
        brand: pm.card?.brand ?? 'unknown',
        last4: pm.card?.last4 ?? '????',
        exp_month: pm.card?.exp_month ?? 0,
        exp_year: pm.card?.exp_year ?? 0,
      },
    }));

    return json({ paymentMethods, defaultPaymentMethodId });
  } catch (err) {
    return errorResponse('list-payment-methods', err);
  }
});
