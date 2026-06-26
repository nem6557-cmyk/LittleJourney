// Supabase Edge Function: Create Stripe Invoice for Tuition
// Creates a Stripe Invoice linked to the daycare's Connect account

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' });
const PLATFORM_FEE_PERCENT = 5; // 5% platform fee

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

    const { invoiceId } = await req.json();

    // Get invoice details
    const { data: invoice } = await supabase.from('invoices')
      .select('*, daycare:daycares!daycare_id(stripe_account_id), parent:profiles!parent_id(id, email, first_name, last_name, stripe_customer_id)')
      .eq('id', invoiceId)
      .single();

    if (!invoice) return new Response('Invoice not found', { status: 404 });

    // Idempotency: if a Stripe invoice already exists for this row, return it
    // rather than creating a duplicate (handles client retries / double-taps).
    if (invoice.stripe_invoice_id) {
      const existing = await stripe.invoices.retrieve(invoice.stripe_invoice_id);
      return new Response(JSON.stringify({
        stripeInvoiceId: existing.id,
        hostedInvoiceUrl: existing.hosted_invoice_url,
        idempotent: true,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Authorize: caller must be an admin of this invoice's daycare
    const { data: callerProfile } = await supabase.from('profiles')
      .select('role, daycare_id')
      .eq('id', user.id)
      .single();

    if (!callerProfile || callerProfile.role !== 'admin' || callerProfile.daycare_id !== invoice.daycare_id) {
      return new Response('Forbidden', { status: 403 });
    }

    const stripeAccountId = (invoice as any).daycare?.stripe_account_id;
    if (!stripeAccountId) {
      return new Response('Daycare has not completed Stripe onboarding', { status: 400 });
    }

    // Resolve the parent's Stripe customer by the stored id (stable, tied to
    // the user) — never by mutable email. Create + persist on first use.
    const parent = (invoice as any).parent;
    let customerId: string | undefined = parent?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: parent?.email,
        name: `${parent?.first_name ?? ''} ${parent?.last_name ?? ''}`.trim(),
        metadata: { supabase_uid: parent?.id ?? '' },
      });
      customerId = customer.id;
      if (parent?.id) {
        await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', parent.id);
      }
    }

    // Create Stripe Invoice (idempotencyKey guards against duplicate creation
    // if this function is retried before the DB write below lands).
    const stripeInvoice = await stripe.invoices.create({
      customer: customerId,
      collection_method: 'send_invoice',
      days_until_due: 7,
      metadata: { invoice_id: invoiceId, daycare_id: invoice.daycare_id },
      application_fee_amount: Math.round(invoice.amount_cents * PLATFORM_FEE_PERCENT / 100),
      transfer_data: { destination: stripeAccountId },
    }, { idempotencyKey: `invoice-${invoiceId}` });

    // Add line items
    const lineItems = invoice.line_items as any[];
    for (const item of lineItems) {
      await stripe.invoiceItems.create({
        customer: customerId,
        invoice: stripeInvoice.id,
        amount: item.amount,
        currency: 'usd',
        description: item.description,
      });
    }

    // Finalize and send
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(stripeInvoice.id);
    await stripe.invoices.sendInvoice(stripeInvoice.id);

    // Update our invoice with Stripe ID
    await supabase.from('invoices').update({
      stripe_invoice_id: stripeInvoice.id,
      status: 'pending',
    }).eq('id', invoiceId);

    // Notify parent
    await supabase.from('notifications').insert({
      user_id: invoice.parent_id,
      daycare_id: invoice.daycare_id,
      type: 'alert',
      title: 'New Invoice',
      body: `You have a new invoice for $${(invoice.amount_cents / 100).toFixed(2)}: ${invoice.description}`,
      data: { invoice_id: invoiceId },
    });

    return new Response(JSON.stringify({
      stripeInvoiceId: stripeInvoice.id,
      hostedInvoiceUrl: finalizedInvoice.hosted_invoice_url,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
});
