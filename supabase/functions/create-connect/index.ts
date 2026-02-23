// Supabase Edge Function: Create Stripe Connect Account for Daycare
// Enables daycares to accept payments (tuition) through the platform

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' });

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return new Response('Unauthorized', { status: 401 });

    const { daycareId, returnUrl } = await req.json();

    // Verify user is admin of this daycare
    const { data: profile } = await supabase.from('profiles')
      .select('role, daycare_id')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin' || profile?.daycare_id !== daycareId) {
      return new Response('Forbidden', { status: 403 });
    }

    // Check if daycare already has a Stripe account
    const { data: daycare } = await supabase.from('daycares')
      .select('stripe_account_id, name, email')
      .eq('id', daycareId)
      .single();

    let accountId = daycare?.stripe_account_id;

    if (!accountId) {
      // Create new Connect Express account
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        email: daycare?.email || undefined,
        business_type: 'company',
        company: { name: daycare?.name },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { daycare_id: daycareId },
      });

      accountId = account.id;

      // Save to database
      await supabase.from('daycares').update({
        stripe_account_id: accountId,
      }).eq('id', daycareId);
    }

    // Create onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: returnUrl || 'littlejourney://connect-refresh',
      return_url: returnUrl || 'littlejourney://connect-success',
      type: 'account_onboarding',
    });

    return new Response(JSON.stringify({
      accountId,
      onboardingUrl: accountLink.url,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
});
