// Supabase Edge Function: Stripe Webhook Handler
// Handles Stripe events for subscriptions, invoices, and Connect
// Deploy: supabase functions deploy stripe-webhook

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' });
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! // Service role for admin access
);

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('Missing signature', { status: 400 });

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    return new Response(`Webhook Error: ${(err as Error).message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      // ---- Daycare Subscriptions ----
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const daycareId = session.metadata?.daycare_id;
        const parentId = session.metadata?.parent_id;
        const subscriptionId = session.subscription as string;

        // Use Stripe's actual period end rather than assuming 30 days.
        let periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          periodEnd = new Date(sub.current_period_end * 1000).toISOString();
        }

        if (daycareId && !parentId) {
          // Daycare subscription
          await supabase.from('subscriptions').upsert({
            daycare_id: daycareId,
            stripe_subscription_id: subscriptionId,
            plan_tier: session.metadata?.plan_tier || 'starter',
            status: 'active',
            current_period_end: periodEnd,
          }, { onConflict: 'daycare_id' });

          await supabase.from('daycares').update({
            subscription_tier: session.metadata?.plan_tier || 'starter',
          }).eq('id', daycareId);
        }

        if (parentId) {
          // Parent premium subscription
          await supabase.from('parent_subscriptions').upsert({
            parent_id: parentId,
            daycare_id: daycareId!,
            stripe_subscription_id: subscriptionId,
            plan: 'premium',
            status: 'active',
            current_period_end: periodEnd,
          }, { onConflict: 'parent_id,daycare_id' });
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const invoiceId = invoice.metadata?.invoice_id;
        if (invoiceId) {
          await supabase.from('invoices').update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            stripe_invoice_id: invoice.id,
          }).eq('id', invoiceId);

          // Send notification to parent
          const { data: dbInvoice } = await supabase.from('invoices').select('parent_id, description').eq('id', invoiceId).single();
          if (dbInvoice) {
            await supabase.from('notifications').insert({
              user_id: dbInvoice.parent_id,
              type: 'alert',
              title: 'Payment Confirmed',
              body: `Your payment for "${dbInvoice.description}" has been received.`,
            });
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const invoiceId = invoice.metadata?.invoice_id;
        if (invoiceId) {
          await supabase.from('invoices').update({ status: 'overdue' }).eq('id', invoiceId);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        // Update daycare subscription
        await supabase.from('subscriptions').update({
          status: sub.status === 'active' ? 'active' : sub.status === 'past_due' ? 'past_due' : 'canceled',
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        }).eq('stripe_subscription_id', sub.id);

        // Also check parent subscriptions
        await supabase.from('parent_subscriptions').update({
          status: sub.status === 'active' ? 'active' : sub.status === 'past_due' ? 'past_due' : 'canceled',
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        }).eq('stripe_subscription_id', sub.id);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await supabase.from('subscriptions').update({ status: 'canceled' }).eq('stripe_subscription_id', sub.id);
        await supabase.from('parent_subscriptions').update({ status: 'canceled' }).eq('stripe_subscription_id', sub.id);
        break;
      }

      case 'account.updated': {
        // Stripe Connect: daycare onboarding status
        const account = event.data.object as Stripe.Account;
        if (account.charges_enabled && account.payouts_enabled) {
          await supabase.from('daycares').update({
            stripe_onboarding_complete: true,
          }).eq('stripe_account_id', account.id);
        }
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return new Response(`Handler Error: ${(err as Error).message}`, { status: 500 });
  }
});
