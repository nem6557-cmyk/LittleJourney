import { addBreadcrumb } from './sentry';
import { config } from './config';

/**
 * Lightweight analytics wrapper.
 * In production, this can be swapped with Mixpanel, Amplitude, or PostHog.
 * Currently logs to console in dev and Sentry breadcrumbs in prod.
 */

type EventProperties = Record<string, string | number | boolean | undefined>;

/**
 * Track a user action or event.
 */
export function trackEvent(name: string, properties?: EventProperties): void {
  if (config.environment === 'development') {
    console.log(`[Analytics] ${name}`, properties || '');
    return;
  }

  // In production, log as Sentry breadcrumb for debugging context
  addBreadcrumb('analytics', name, properties as Record<string, unknown>);
}

/**
 * Track screen views for navigation analytics.
 */
export function trackScreen(screenName: string, params?: EventProperties): void {
  trackEvent('screen_view', { screen: screenName, ...params });
}

/**
 * Common analytics events used across the app.
 */
export const AnalyticsEvents = {
  // Auth
  SIGN_UP: 'sign_up',
  SIGN_IN: 'sign_in',
  SIGN_OUT: 'sign_out',
  DEMO_LOGIN: 'demo_login',

  // Daycare
  DAYCARE_CREATED: 'daycare_created',
  CLASSROOM_ADDED: 'classroom_added',
  CHILD_ADDED: 'child_added',
  INVITE_REDEEMED: 'invite_redeemed',

  // Timeline
  ACTIVITY_LOGGED: 'activity_logged',
  PHOTO_UPLOADED: 'photo_uploaded',
  COMMENT_ADDED: 'comment_added',
  REACTION_ADDED: 'reaction_added',

  // Messaging
  MESSAGE_SENT: 'message_sent',
  CONVERSATION_CREATED: 'conversation_created',

  // Attendance
  CHECK_IN: 'check_in',
  CHECK_OUT: 'check_out',

  // Payments
  SUBSCRIPTION_STARTED: 'subscription_started',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
  INVOICE_PAID: 'invoice_paid',
  PREMIUM_UPGRADED: 'premium_upgraded',

  // Features
  DAILY_REPORT_VIEWED: 'daily_report_viewed',
  MILESTONE_RECORDED: 'milestone_recorded',
  INCIDENT_REPORTED: 'incident_reported',
  GALLERY_VIEWED: 'gallery_viewed',
} as const;
