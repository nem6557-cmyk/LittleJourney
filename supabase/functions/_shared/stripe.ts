import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { admin, type Caller } from './auth.ts';
import { HttpError } from './http.ts';

const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
if (!secretKey) console.error('[stripe] STRIPE_SECRET_KEY is not set');

export const stripe = new Stripe(secretKey ?? 'sk_missing', {
  apiVersion: '2023-10-16',
  // Deno has no Node http stack; the fetch client is required.
  httpClient: Stripe.createFetchHttpClient(),
});

export { Stripe };

/** Price IDs for daycare plans. No placeholder fallbacks: a missing ID is a config error. */
export function priceIdForPlan(plan: string): string {
  const map: Record<string, string | undefined> = {
    starter: Deno.env.get('STRIPE_PRICE_STARTER'),
    professional: Deno.env.get('STRIPE_PRICE_PROFESSIONAL'),
    enterprise: Deno.env.get('STRIPE_PRICE_ENTERPRISE'),
  };
  const id = map[plan];
  if (!id) throw new HttpError(400, 'Invalid or unavailable plan.');
  return id;
}

/** Reverse lookup used by the webhook when a plan is changed in the billing portal. */
export function planForPriceId(priceId: string | undefined | null): 'starter' | 'professional' | 'enterprise' | null {
  if (!priceId) return null;
  for (const plan of ['starter', 'professional', 'enterprise'] as const) {
    if (Deno.env.get(`STRIPE_PRICE_${plan.toUpperCase()}`) === priceId) return plan;
  }
  return null;
}

/**
 * Resolve (or create) the Stripe customer for the caller using the id stored on
 * their profile — never by email, which is mutable and not an identity.
 * profiles.stripe_customer_id is write-protected from clients (migration 014).
 */
export interface CustomerSubject {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  stripe_customer_id: string | null;
}

export async function getOrCreateCustomerFor(subject: CustomerSubject): Promise<string> {
  if (subject.stripe_customer_id) return subject.stripe_customer_id;

  const customer = await stripe.customers.create(
    {
      email: subject.email ?? undefined,
      name: [subject.first_name, subject.last_name].filter(Boolean).join(' ') || undefined,
      metadata: { supabase_uid: subject.id },
    },
    // Two concurrent first-time calls must not create two customers.
    { idempotencyKey: `customer-${subject.id}` },
  );

  // Only set if still empty so a racing call can't overwrite the winner.
  await admin
    .from('profiles')
    .update({ stripe_customer_id: customer.id })
    .eq('id', subject.id)
    .is('stripe_customer_id', null);

  const { data } = await admin.from('profiles').select('stripe_customer_id').eq('id', subject.id).single();
  return (data?.stripe_customer_id as string | null) ?? customer.id;
}

export function getOrCreateCustomer(caller: Caller): Promise<string> {
  return getOrCreateCustomerFor(caller.profile);
}

/** Customer id for read/modify flows where creating one would be wrong. */
export function existingCustomerId(caller: Caller): string | null {
  return caller.profile.stripe_customer_id ?? null;
}

const DEFAULT_ALLOWED_ORIGINS = ['https://littlejourney.app'];

/**
 * Only redirect users back to our own app: the custom scheme or an allow-listed
 * https origin (APP_ALLOWED_RETURN_ORIGINS, comma-separated). Anything else —
 * including a caller-supplied attacker URL — falls back to the default.
 */
export function safeReturnUrl(candidate: unknown, fallback: string): string {
  if (typeof candidate !== 'string' || candidate.length === 0 || candidate.length > 2048) return fallback;
  try {
    const url = new URL(candidate);
    if (url.protocol === 'littlejourney:') return candidate;
    const extra = (Deno.env.get('APP_ALLOWED_RETURN_ORIGINS') ?? '')
      .split(',').map((s) => s.trim()).filter(Boolean);
    const allowed = new Set([...DEFAULT_ALLOWED_ORIGINS, ...extra]);
    if (url.protocol === 'https:' && allowed.has(url.origin)) return candidate;
    // Local dev only
    if (Deno.env.get('APP_ENV') !== 'production' && url.protocol === 'http:' && url.hostname === 'localhost') return candidate;
  } catch {
    // not a URL
  }
  return fallback;
}
