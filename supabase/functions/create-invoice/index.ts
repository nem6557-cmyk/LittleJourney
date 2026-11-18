// Supabase Edge Function: create/send/return the Stripe-hosted payment page for a
// tuition invoice (Stripe Connect destination charge with a platform fee).
//
// Who may call: the daycare ADMIN of the invoice's daycare (to issue it) or the
// invoice's PARENT (to pay it). Anyone else gets 403 *before* any Stripe data is
// read, so hosted-invoice URLs can't be harvested by other tenants.
//
// Every Stripe write carries a deterministic idempotency key, so a retry after a
// partial failure resumes instead of duplicating invoices or line items.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { admin, requireCaller } from '../_shared/auth.ts';
import { errorResponse, HttpError, json, preflight, readJson } from '../_shared/http.ts';
import { getOrCreateCustomerFor, stripe } from '../_shared/stripe.ts';

const PLATFORM_FEE_PERCENT = Number(Deno.env.get('PLATFORM_FEE_PERCENT') ?? '5');

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const caller = await requireCaller(req);
    const { invoiceId } = await readJson<{ invoiceId?: string }>(req);
    if (!invoiceId || typeof invoiceId !== 'string') throw new HttpError(400, 'invoiceId is required.');

    const { data: invoice } = await admin
      .from('invoices')
      .select('*, daycare:daycares!daycare_id(stripe_account_id, stripe_onboarding_complete), parent:profiles!parent_id(id, email, first_name, last_name, stripe_customer_id)')
      .eq('id', invoiceId)
      .single();
    if (!invoice) throw new HttpError(404, 'Invoice not found.');

    const isAdmin = caller.profile.role === 'admin' && caller.profile.daycare_id === invoice.daycare_id;
    const isParent = caller.user.id === invoice.parent_id;
    if (!isAdmin && !isParent) throw new HttpError(403, 'Forbidden');

    if (invoice.status === 'paid') throw new HttpError(409, 'This invoice has already been paid.');
    if (invoice.status === 'void') throw new HttpError(409, 'This invoice was cancelled.');
    if (invoice.status === 'draft' && !isAdmin) throw new HttpError(409, 'This invoice has not been issued yet.');

    // Already in Stripe → just (re)open it.
    if (invoice.stripe_invoice_id) {
      let existing = await stripe.invoices.retrieve(invoice.stripe_invoice_id);
      if (existing.status === 'paid') throw new HttpError(409, 'This invoice has already been paid.');
      if (existing.status === 'void' || existing.status === 'uncollectible') {
        throw new HttpError(409, 'This invoice can no longer be paid. Contact your daycare.');
      }
      if (existing.status === 'draft') existing = await stripe.invoices.finalizeInvoice(existing.id);
      return json({ stripeInvoiceId: existing.id, hostedInvoiceUrl: existing.hosted_invoice_url });
    }

    const stripeAccountId = invoice.daycare?.stripe_account_id as string | undefined;
    if (!stripeAccountId || !invoice.daycare?.stripe_onboarding_complete) {
      throw new HttpError(
        400,
        isAdmin
          ? 'Finish Stripe payout setup in Billing before sending invoices.'
          : 'Your daycare has not enabled online payments yet. Please pay them directly.',
      );
    }

    // Defence in depth on top of the DB trigger.
    const lineItems = (invoice.line_items ?? []) as Array<{ description?: string; amount?: number }>;
    const lineSum = lineItems.reduce((s, it) => s + (Number.isInteger(it.amount) ? (it.amount as number) : NaN), 0);
    if (!lineItems.length || lineSum !== invoice.amount_cents || invoice.amount_cents <= 0) {
      throw new HttpError(400, 'Invoice line items do not add up to the total.');
    }

    const customerId = await getOrCreateCustomerFor(invoice.parent);

    const dueTs = Math.floor(new Date(`${invoice.due_date}T23:59:59Z`).getTime() / 1000);
    const days = Math.max(1, Math.min(90, Math.ceil((dueTs - Date.now() / 1000) / 86400)));

    const stripeInvoice = await stripe.invoices.create(
      {
        customer: customerId,
        collection_method: 'send_invoice',
        days_until_due: days,
        auto_advance: false,
        description: invoice.description,
        metadata: { invoice_id: invoiceId, daycare_id: invoice.daycare_id },
        application_fee_amount: Math.round((invoice.amount_cents * PLATFORM_FEE_PERCENT) / 100),
        transfer_data: { destination: stripeAccountId },
      },
      { idempotencyKey: `invoice-${invoiceId}` },
    );

    for (let i = 0; i < lineItems.length; i++) {
      await stripe.invoiceItems.create(
        {
          customer: customerId,
          invoice: stripeInvoice.id,
          amount: lineItems[i].amount as number,
          currency: 'usd',
          description: lineItems[i].description || invoice.description,
        },
        { idempotencyKey: `invoice-${invoiceId}-item-${i}` },
      );
    }

    const finalized = await stripe.invoices.finalizeInvoice(stripeInvoice.id);
    if (isAdmin) {
      // Stripe emails the parent a hosted payment link.
      await stripe.invoices.sendInvoice(stripeInvoice.id).catch((e) => console.warn('[create-invoice] sendInvoice', e));
    }

    // Service role writes the Stripe link (clients can't — migration 014).
    await admin
      .from('invoices')
      .update({ stripe_invoice_id: stripeInvoice.id, status: 'pending' })
      .eq('id', invoiceId);

    if (isAdmin) {
      await admin.from('notifications').insert({
        user_id: invoice.parent_id,
        daycare_id: invoice.daycare_id,
        type: 'alert',
        title: 'New Invoice',
        body: `You have a new invoice for $${(invoice.amount_cents / 100).toFixed(2)}: ${invoice.description}`,
        data: { invoice_id: invoiceId },
      });
    }

    return json({ stripeInvoiceId: stripeInvoice.id, hostedInvoiceUrl: finalized.hosted_invoice_url });
  } catch (err) {
    return errorResponse('create-invoice', err);
  }
});
