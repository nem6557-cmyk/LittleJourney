// Supabase Edge Function: create a Stripe SetupIntent so the caller can save a card.
// The customer is the one stored on the caller's profile (never looked up by email).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { requireCaller } from '../_shared/auth.ts';
import { errorResponse, json, preflight } from '../_shared/http.ts';
import { getOrCreateCustomer, stripe } from '../_shared/stripe.ts';

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const caller = await requireCaller(req);
    const customerId = await getOrCreateCustomer(caller);

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session',
      metadata: { supabase_uid: caller.user.id },
    });

    return json({ clientSecret: setupIntent.client_secret });
  } catch (err) {
    return errorResponse('create-setup-intent', err);
  }
});
