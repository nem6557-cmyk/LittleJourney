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

  // Feature flags
  enableOfflineMode: true,
  enablePushNotifications: true,
  enableAnalytics: process.env.EXPO_PUBLIC_ENV === 'production',

  // Subscription
  daycareTrial: {
    durationDays: 14,
  },
  plans: {
    daycare: {
      starter: { id: 'price_starter', price: 2900, childLimit: 20, classroomLimit: 1 },
      professional: { id: 'price_professional', price: 5900, childLimit: 50, classroomLimit: 5 },
      enterprise: { id: 'price_enterprise', price: 9900, childLimit: -1, classroomLimit: -1 },
    },
    parent: {
      free: { id: 'price_parent_free', price: 0 },
      premium: { id: 'price_parent_premium', price: 499 },
    },
  },
} as const;

export const isDev = config.environment === 'development';
export const isStaging = config.environment === 'staging';
export const isProd = config.environment === 'production';
