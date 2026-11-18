import { Linking, Platform } from 'react-native';
import { supabase } from './supabase';
import { config } from './config';

/**
 * Stripe configuration and billing helpers for LittleJourney.
 *
 * This module is config + server-driven billing only. Payments are collected
 * through Stripe-hosted Checkout (see createCheckoutSession), which opens in the
 * browser — there is no in-app card entry, so @stripe/stripe-react-native's
 * StripeProvider / PaymentSheet is NOT wired up here. If native in-app card
 * collection is added later, wrap the app root in <StripeProvider> using
 * stripeConfig.publishableKey.
 *
 * Exports: the stripeConfig / price / feature-gating constants and the
 * checkout + subscription-status helpers below.
 */

export const stripeConfig = {
  publishableKey: config.stripePublishableKey,
  merchantIdentifier: 'merchant.com.littlejourney.app',
  urlScheme: 'littlejourney',
};

/**
 * Plan pricing IDs — mapped to Stripe Price IDs.
 * In production, replace these with actual Stripe price_xxx IDs from your dashboard.
 */
export const STRIPE_PRICES = {
  daycare: {
    starter: config.plans.daycare.starter.id,
    professional: config.plans.daycare.professional.id,
    enterprise: config.plans.daycare.enterprise.id,
  },
  parent: {
    free: config.plans.parent.free.id,
    premium: config.plans.parent.premium.id,
  },
} as const;

/**
 * Platform fee percentage for tuition invoicing via Stripe Connect.
 */
export const PLATFORM_FEE_PERCENT = 5;

/**
 * Calculate platform fee from an amount in cents.
 */
export function calculatePlatformFee(amountCents: number): number {
  return Math.round(amountCents * (PLATFORM_FEE_PERCENT / 100));
}

/**
 * Feature gating based on subscription tier.
 */
export const PLAN_FEATURES = {
  starter: {
    maxChildren: 20,
    maxClassrooms: 1,
    photoGallery: false,
    tuitionInvoicing: false,
    prioritySupport: false,
    apiAccess: false,
  },
  professional: {
    maxChildren: 50,
    maxClassrooms: 5,
    photoGallery: true,
    tuitionInvoicing: true,
    prioritySupport: false,
    apiAccess: false,
  },
  enterprise: {
    maxChildren: Infinity,
    maxClassrooms: Infinity,
    photoGallery: true,
    tuitionInvoicing: true,
    prioritySupport: true,
    apiAccess: true,
  },
} as const;

export const PARENT_FEATURES = {
  free: {
    hdPhotos: false,
    detailedReports: false,
    milestoneAnalytics: false,
  },
  premium: {
    hdPhotos: true,
    detailedReports: true,
    milestoneAnalytics: true,
  },
} as const;

/**
 * Check if a daycare feature is available for the given plan tier.
 */
type BooleanFeatureKeys = {
  [K in keyof (typeof PLAN_FEATURES)['starter']]: (typeof PLAN_FEATURES)['starter'][K] extends boolean ? K : never;
}[keyof (typeof PLAN_FEATURES)['starter']];

export function isDaycareFeatureEnabled(
  tier: keyof typeof PLAN_FEATURES | undefined,
  feature: BooleanFeatureKeys
): boolean {
  if (!tier) return false;
  return (PLAN_FEATURES[tier]?.[feature] as boolean) ?? false;
}

/**
 * Check if a parent feature is available for the given plan.
 */
export function isParentFeatureEnabled(
  plan: keyof typeof PARENT_FEATURES | undefined,
  feature: keyof (typeof PARENT_FEATURES)['free']
): boolean {
  if (!plan) return false;
  return PARENT_FEATURES[plan]?.[feature] ?? false;
}

function defaultReturnUrl(path: string): string {
  return Platform.OS === 'web' && typeof window !== 'undefined'
    ? `${window.location.origin}/${path}`
    : `littlejourney://${path}`;
}

async function openUrl(url: string): Promise<void> {
  if (Platform.OS === 'web') {
    window.location.href = url;
  } else {
    await Linking.openURL(url);
  }
}

/** Pull a human-readable message out of a supabase.functions.invoke() error. */
async function functionErrorMessage(error: unknown, fallback: string): Promise<string> {
  try {
    const ctx = (error as { context?: Response })?.context;
    if (ctx && typeof ctx.json === 'function') {
      const body = await ctx.json();
      if (body?.error && typeof body.error === 'string') return body.error;
    }
  } catch {
    // body already consumed / not JSON
  }
  return fallback;
}

export type BillingResult = { ok: true } | { ok: false; error: string };

/**
 * Start Stripe Checkout for a DAYCARE plan (admin only; the server derives the
 * daycare from the caller). Web only — see canPurchaseSubscriptionHere().
 */
export async function createCheckoutSession(params: {
  plan: 'starter' | 'professional' | 'enterprise';
  returnUrl?: string;
}): Promise<BillingResult> {
  try {
    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: { plan: params.plan, returnUrl: params.returnUrl || defaultReturnUrl('payment-success') },
    });
    if (error) return { ok: false, error: await functionErrorMessage(error, 'Could not start checkout. Please try again.') };
    if (!data?.url) return { ok: false, error: 'No checkout URL returned.' };
    await openUrl(data.url);
    return { ok: true };
  } catch (err) {
    console.error('[Stripe] Checkout session error:', err);
    return { ok: false, error: 'Could not start checkout. Please try again.' };
  }
}

/** Open the Stripe Customer Portal (change plan / update card / cancel). */
export async function openBillingPortal(returnUrl?: string): Promise<BillingResult> {
  try {
    const { data, error } = await supabase.functions.invoke('create-billing-portal', {
      body: { returnUrl: returnUrl || defaultReturnUrl('billing-return') },
    });
    if (error) return { ok: false, error: await functionErrorMessage(error, 'Could not open billing. Please try again.') };
    if (!data?.url) return { ok: false, error: 'No billing link returned.' };
    await openUrl(data.url);
    return { ok: true };
  } catch (err) {
    console.error('[Stripe] Billing portal error:', err);
    return { ok: false, error: 'Could not open billing. Please try again.' };
  }
}

export interface ConnectStatus {
  accountId: string | null;
  onboardingComplete: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
}

/** Current Stripe Connect payout-onboarding state for the admin's daycare. */
export async function getConnectStatus(): Promise<ConnectStatus | null> {
  try {
    const { data, error } = await supabase.functions.invoke('create-connect', { body: { action: 'status' } });
    if (error || !data) return null;
    return data as ConnectStatus;
  } catch {
    return null;
  }
}

/** Open Stripe-hosted onboarding (or the Express dashboard once complete). */
export async function openConnect(action: 'onboard' | 'dashboard'): Promise<BillingResult> {
  try {
    const { data, error } = await supabase.functions.invoke('create-connect', {
      body: { action, returnUrl: defaultReturnUrl('connect-success') },
    });
    if (error) return { ok: false, error: await functionErrorMessage(error, 'Could not open Stripe. Please try again.') };
    const url = data?.onboardingUrl ?? data?.url;
    if (!url) return { ok: false, error: 'No link returned.' };
    await openUrl(url);
    return { ok: true };
  } catch (err) {
    console.error('[Stripe] Connect error:', err);
    return { ok: false, error: 'Could not open Stripe. Please try again.' };
  }
}

/** Ask the server to (create and) open the hosted payment page for an invoice. */
export async function openInvoicePayment(invoiceId: string): Promise<BillingResult> {
  try {
    const { data, error } = await supabase.functions.invoke('create-invoice', { body: { invoiceId } });
    if (error) return { ok: false, error: await functionErrorMessage(error, 'Could not start payment. Please try again.') };
    const url = (data as { hostedInvoiceUrl?: string } | null)?.hostedInvoiceUrl;
    if (!url) return { ok: false, error: 'No payment link was returned for this invoice.' };
    await openUrl(url);
    return { ok: true };
  } catch (err) {
    console.error('[Stripe] Invoice payment error:', err);
    return { ok: false, error: 'Could not open the payment page.' };
  }
}

/**
 * Get the current subscription status for a daycare or parent.
 */
export async function getSubscriptionStatus(daycareId?: string, parentId?: string): Promise<{
  status: string;
  plan: string | null;
  trialEnd: string | null;
} | null> {
  try {
    if (daycareId) {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('status, plan_tier, current_period_end')
        .eq('daycare_id', daycareId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (error) return null;
      return { status: data.status, plan: data.plan_tier, trialEnd: data.current_period_end };
    }
    if (parentId) {
      const { data, error } = await supabase
        .from('parent_subscriptions')
        .select('status, plan')
        .eq('parent_id', parentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (error) return null;
      return { status: data.status, plan: data.plan, trialEnd: null };
    }
    return null;
  } catch {
    return null;
  }
}
