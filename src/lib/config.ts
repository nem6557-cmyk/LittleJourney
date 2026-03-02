/**
 * Environment configuration for LittleJourney
 * Values are loaded from .env files via Expo's built-in env support
 */

export const config = {
  // Supabase
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',

  // Stripe
  stripePublishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',

  // Sentry
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN || '',

  // Environment
  environment: (process.env.EXPO_PUBLIC_ENV || 'development') as 'development' | 'staging' | 'production',

  // App
  appName: 'LittleJourney',
  appVersion: '1.0.0',
  supportEmail: 'support@littlejourney.app',
  privacyEmail: 'privacy@littlejourney.app',
  legalEmail: 'legal@littlejourney.app',
  privacyPolicyUrl: process.env.EXPO_PUBLIC_PRIVACY_URL || '/privacy.html',
  termsUrl: process.env.EXPO_PUBLIC_TERMS_URL || '/terms.html',
  supportUrl: 'https://littlejourney.app/support',

  // Feature flags
  enableOfflineMode: true,
  enablePushNotifications: true,
  enableAnalytics: process.env.EXPO_PUBLIC_ENV === 'production',

  // Subscription — price IDs are read from env or use dev placeholders
  // In production, set these via EAS secrets or Supabase Edge Function env vars
  daycareTrial: {
    durationDays: 14,
  },
  plans: {
    daycare: {
      starter: {
        id: process.env.EXPO_PUBLIC_STRIPE_PRICE_STARTER || 'price_starter_placeholder',
        price: 2900, childLimit: 20, classroomLimit: 1,
      },
      professional: {
        id: process.env.EXPO_PUBLIC_STRIPE_PRICE_PROFESSIONAL || 'price_professional_placeholder',
        price: 5900, childLimit: 50, classroomLimit: 5,
      },
      enterprise: {
        id: process.env.EXPO_PUBLIC_STRIPE_PRICE_ENTERPRISE || 'price_enterprise_placeholder',
        price: 9900, childLimit: -1, classroomLimit: -1,
      },
    },
    parent: {
      free: { id: 'price_parent_free', price: 0 },
      premium: {
        id: process.env.EXPO_PUBLIC_STRIPE_PRICE_PARENT_PREMIUM || 'price_parent_premium_placeholder',
        price: 1000,
      },
    },
  },
};

export const isDev = config.environment === 'development';
export const isStaging = config.environment === 'staging';
export const isProd = config.environment === 'production';

// Validate required environment variables in production
if (isProd) {
  const required: [string, string][] = [
    ['EXPO_PUBLIC_SUPABASE_URL', config.supabaseUrl],
    ['EXPO_PUBLIC_SUPABASE_ANON_KEY', config.supabaseAnonKey],
  ];
  for (const [name, value] of required) {
    if (!value || value.includes('placeholder') || value.includes('YOUR_')) {
      console.error(`[Config] Missing required env var: ${name}`);
    }
  }
}
