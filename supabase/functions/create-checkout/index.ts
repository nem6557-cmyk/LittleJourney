// Supabase Edge Function: Create Stripe Checkout Session
// Used for both daycare subscriptions and parent premium upgrades

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' });

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const PRICE_IDS: Record<string, string> = {
  starter: Deno.env.get('STRIPE_PRICE_STARTER') || 'price_starter',
  professional: Deno.env.get('STRIPE_PRICE_PROFESSIONAL') || 'price_professional',
  enterprise: Deno.env.get('STRIPE_PRICE_ENTERPRISE') || 'price_enterprise',
  parent_premium: Deno.env.get('STRIPE_PRICE_PARENT_PREMIUM') || 'price_parent_premium',
};

serve(async (req) => {
  try {
    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return new Response('Unauthorized', { status: 401 });

    const { plan, daycareId, returnUrl } = await req.json();

    // Get caller profile (also used for authorization below)
    const { data: profile } = await supabase.from('profiles')
      .select('email, first_name, last_name, role, daycare_id')
      .eq('id', user.id)
      .single();

    if (!profile) return new Response('Forbidden', { status: 403 });

    // Authorize daycare-subscription plans: caller must be an admin, and the
    // daycare is taken from their own profile (never trust a client-supplied id).
    const isParentPlanRequest = plan === 'parent_premium';
    let effectiveDaycareId = daycareId;
    if (!isParentPlanRequest) {
      if (profile.role !== 'admin' || !profile.daycare_id) {
        return new Response('Forbidden', { status: 403 });
      }
      effectiveDaycareId = profile.daycare_id;
    }

    let customerId: string;
    const customers = await stripe.customers.list({ email: profile?.email, limit: 1 });
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: profile?.email,
        name: `${profile?.first_name} ${profile?.last_name}`,
        metadata: { supabase_uid: user.id },
      });
      customerId = customer.id;
    }

    const priceId = PRICE_IDS[plan];
    if (!priceId) return new Response('Invalid plan', { status: 400 });

    const isParentPlan = isParentPlanRequest;
    const metadata: Record<string, string> = {};
    if (isParentPlan) {
      metadata.parent_id = user.id;
      metadata.daycare_id = effectiveDaycareId;
    } else {
      metadata.daycare_id = effectiveDaycareId;
      metadata.plan_tier = plan;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      subscription_data: {
        trial_period_days: isParentPlan ? undefined : 14,
        metadata,
      },
      metadata,
      success_url: returnUrl || 'littlejourney://payment-success',
      cancel_url: returnUrl || 'littlejourney://payment-cancel',
    });

    return new Response(JSON.stringify({ sessionId: session.id, url: session.url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
});
