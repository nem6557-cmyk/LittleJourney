import { config } from './config';

/**
 * Stripe configuration for LittleJourney.
 *
 * In the actual app, import and wrap root with:
 *   import { StripeProvider } from '@stripe/stripe-react-native';
 *
 *   <StripeProvider publishableKey={stripeConfig.publishableKey}>
 *     <App />
 *   </StripeProvider>
 *
 * This file provides the configuration constants and helper methods.
 */

export const stripeConfig = {
  publishableKey: config.stripePublishableKey,
  merchantIdentifier: 'merchant.com.littlejourney',
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
