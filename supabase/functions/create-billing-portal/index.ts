// Supabase Edge Function: open the Stripe Customer Portal so a daycare admin can
// change plan, update the card, view invoices, or cancel — required for a
// subscription product (users must be able to cancel as easily as they signed up).
// Requires the portal to be configured once in the Stripe dashboard
// (Settings → Billing → Customer portal).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { requireAdmin, requireCaller } from '../_shared/auth.ts';
import { errorResponse, HttpError, json, preflight, readJson } from '../_shared/http.ts';
import { existingCustomerId, safeReturnUrl, stripe } from '../_shared/stripe.ts';

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const caller = await requireCaller(req);
    requireAdmin(caller);
    const body = await readJson<{ returnUrl?: string }>(req);

    const customerId = existingCustomerId(caller);
    if (!customerId) throw new HttpError(404, 'No billing account yet. Choose a plan first.');

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: safeReturnUrl(body.returnUrl, 'littlejourney://billing-return'),
    });
    return json({ url: session.url });
  } catch (err) {
    return errorResponse('create-billing-portal', err);
  }
});
