// Supabase Edge Function: Stripe webhook — the ONLY writer of payment state.
// Deploy with verify_jwt = false (Stripe signs requests; we verify the signature).
//
// Register TWO endpoints in Stripe pointing at this URL:
//   1. Account events           → secret in STRIPE_WEBHOOK_SECRET
//      checkout.session.completed, customer.subscription.updated/deleted,
//      invoice.paid, invoice.payment_failed, invoice.voided,
//      invoice.marked_uncollectible
//   2. Connect ("events on connected accounts") → STRIPE_CONNECT_WEBHOOK_SECRET
//      account.updated
//
// Reliability: each event id is recorded as 'processing' first; success marks it
// 'done'; a failure DELETES the row so Stripe's retry runs again. (The previous
// version kept the row on failure, so a transient error permanently swallowed
// the event.) Signature verification is async — the sync variant throws under
// Deno's WebCrypto.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { admin } from '../_shared/auth.ts';
import { planForPriceId, Stripe, stripe } from '../_shared/stripe.ts';

const secrets = [Deno.env.get('STRIPE_WEBHOOK_SECRET'), Deno.env.get('STRIPE_CONNECT_WEBHOOK_SECRET')]
  .filter((s): s is string => !!s);
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const STALE_PROCESSING_MS = 5 * 60 * 1000;

// [max children, max classrooms] — mirrors PLAN_FEATURES in src/lib/stripe.ts.
const PLAN_LIMITS: Record<string, [number, number] | undefined> = {
  starter: [20, 1],
  professional: [50, 5],
  enterprise: [100000, 1000],
};

type SubStatus = 'active' | 'trialing' | 'past_due' | 'canceled';

/** Map Stripe status → our enum. null = transitional, leave the row alone. */
function mapSubStatus(status: string): SubStatus | null {
  switch (status) {
    case 'active': return 'active';
    case 'trialing': return 'trialing';
    case 'past_due': return 'past_due';
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
      return 'canceled';
    default:
      return null;
  }
}

async function verify(body: string, signature: string): Promise<Stripe.Event> {
  let lastErr: unknown = new Error('No webhook secret configured');
  for (const secret of secrets) {
    try {
      return await stripe.webhooks.constructEventAsync(body, signature, secret, undefined, cryptoProvider);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

async function syncDaycareSubscription(sub: Stripe.Subscription, daycareIdHint?: string) {
  const mapped = mapSubStatus(sub.status);
  if (!mapped) return;

  const plan = planForPriceId(sub.items.data[0]?.price?.id) ?? (sub.metadata?.plan_tier as string | undefined) ?? null;
  const row: Record<string, unknown> = {
    stripe_subscription_id: sub.id,
    status: mapped,
    current_period_end: new Date((sub.trial_end && sub.status === 'trialing' ? sub.trial_end : sub.current_period_end) * 1000).toISOString(),
  };
  if (plan) row.plan_tier = plan;

  const daycareId = daycareIdHint ?? sub.metadata?.daycare_id;
  if (daycareId) {
    await admin.from('subscriptions').upsert({ daycare_id: daycareId, ...row }, { onConflict: 'daycare_id' });
    const limits = plan ? PLAN_LIMITS[plan] : undefined;
    if (plan && limits && mapped !== 'canceled') {
      await admin.from('daycares').update({
        subscription_tier: plan,
        max_children: limits[0],
        max_classrooms: limits[1],
        trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
      }).eq('id', daycareId);
    }
  } else {
    await admin.from('subscriptions').update(row).eq('stripe_subscription_id', sub.id);
  }
}

async function handle(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== 'subscription' || !session.subscription) break;
      const daycareId = session.metadata?.daycare_id;
      if (!daycareId) break;
      const sub = await stripe.subscriptions.retrieve(session.subscription as string);
      await syncDaycareSubscription(sub, daycareId);
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      await syncDaycareSubscription(event.data.object as Stripe.Subscription);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await admin.from('subscriptions').update({ status: 'canceled' }).eq('stripe_subscription_id', sub.id);
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      const invoiceId = invoice.metadata?.invoice_id;
      if (!invoiceId) break; // subscription invoice — handled via subscription events

      const { data: db } = await admin
        .from('invoices')
        .select('parent_id, daycare_id, description, amount_cents, status')
        .eq('id', invoiceId)
        .maybeSingle();
      if (!db) { console.warn('[webhook] paid Stripe invoice has no DB row', invoiceId); break; }
      if (db.status === 'paid') break;

      // Never mark paid for a different amount than we billed.
      if (invoice.amount_paid !== db.amount_cents) {
        console.error('[webhook] amount mismatch', { invoiceId, paid: invoice.amount_paid, expected: db.amount_cents });
        break;
      }

      await admin.from('invoices').update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        stripe_invoice_id: invoice.id,
      }).eq('id', invoiceId);

      await admin.from('notifications').insert({
        user_id: db.parent_id,
        daycare_id: db.daycare_id,
        type: 'alert',
        title: 'Payment Confirmed',
        body: `Your payment for "${db.description}" has been received.`,
        data: { invoice_id: invoiceId },
      });
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const invoiceId = invoice.metadata?.invoice_id;
      if (!invoiceId) break;
      // A failed attempt doesn't make an invoice overdue (that depends on the due
      // date); tell the parent so they can retry with another card.
      const { data: db } = await admin.from('invoices').select('parent_id, daycare_id, description').eq('id', invoiceId).maybeSingle();
      if (db) {
        await admin.from('notifications').insert({
          user_id: db.parent_id,
          daycare_id: db.daycare_id,
          type: 'alert',
          title: 'Payment Failed',
          body: `We couldn't process your payment for "${db.description}". Please try another card.`,
          data: { invoice_id: invoiceId },
        });
      }
      break;
    }

    case 'invoice.voided':
    case 'invoice.marked_uncollectible': {
      const invoice = event.data.object as Stripe.Invoice;
      const invoiceId = invoice.metadata?.invoice_id;
      if (invoiceId) await admin.from('invoices').update({ status: 'void' }).eq('id', invoiceId).neq('status', 'paid');
      break;
    }

    case 'account.updated': {
      const account = event.data.object as Stripe.Account;
      const complete = !!(account.charges_enabled && account.payouts_enabled && account.details_submitted);
      await admin.from('daycares').update({ stripe_onboarding_complete: complete }).eq('stripe_account_id', account.id);
      break;
    }
  }
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('Missing signature', { status: 400 });

  let event: Stripe.Event;
  try {
    event = await verify(await req.text(), signature);
  } catch (err) {
    console.warn('[webhook] signature verification failed', (err as Error).message);
    return new Response('Invalid signature', { status: 400 });
  }

  // ── idempotency ──
  const { error: insertError } = await admin
    .from('stripe_events')
    .insert({ id: event.id, event_type: event.type, status: 'processing' });

  if (insertError) {
    if ((insertError as { code?: string }).code !== '23505') {
      console.error('[webhook] dedupe insert failed', insertError);
      return new Response('Temporary error', { status: 500 });
    }
    const { data: prior } = await admin.from('stripe_events').select('status, processed_at').eq('id', event.id).single();
    if (prior?.status === 'done') return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });
    const age = Date.now() - new Date(prior?.processed_at ?? 0).getTime();
    if (age < STALE_PROCESSING_MS) return new Response('Event in progress', { status: 409 });
    await admin.from('stripe_events').update({ processed_at: new Date().toISOString() }).eq('id', event.id);
  }

  try {
    await handle(event);
    await admin.from('stripe_events').update({ status: 'done' }).eq('id', event.id);
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err) {
    console.error('[webhook] handler error', event.type, err);
    // Release the event so Stripe's retry is processed instead of being swallowed.
    await admin.from('stripe_events').delete().eq('id', event.id);
    return new Response('Handler error', { status: 500 });
  }
});
