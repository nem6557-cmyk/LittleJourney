import * as Sentry from '@sentry/react-native';
import { config } from './config';

/**
 * Initialize Sentry error tracking.
 * Call this early in App.tsx before rendering.
 */
export function initSentry(): void {
  if (!config.sentryDsn) {
    console.warn('Sentry DSN not configured — skipping initialization');
    return;
  }

  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.environment,
    enabled: config.environment !== 'development',
    tracesSampleRate: config.environment === 'production' ? 0.2 : 1.0,
    debug: config.environment === 'development',

    // Wizard additions: PII, logs, session replay, feedback
    sendDefaultPii: true,
    enableLogs: true,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1,
    integrations: [
      Sentry.mobileReplayIntegration(),
      Sentry.feedbackIntegration(),
    ],

    // Filter out noisy errors
    beforeSend(event) {
      // Don't send network errors in development
      if (config.environment === 'development') return null;

      // Filter out common non-actionable errors
      const message = event.exception?.values?.[0]?.value || '';
      if (message.includes('Network request failed')) {
        // Tag network errors but don't drop them
        event.tags = { ...event.tags, errorType: 'network' };
      }

      return event;
    },
  });
}

/**
 * Set the currently authenticated user for Sentry context.
 */
export function setSentryUser(user: {
  id: string;
  email?: string;
  role?: string;
  daycareId?: string;
}): void {
  Sentry.setUser({
    id: user.id,
    email: user.email,
  });
  if (user.role) Sentry.setTag('userRole', user.role);
  if (user.daycareId) Sentry.setTag('daycareId', user.daycareId);
}

/**
 * Clear Sentry user context on logout.
 */
export function clearSentryUser(): void {
  Sentry.setUser(null);
}

/**
 * Capture a custom error with optional context.
 */
export function captureError(
  error: Error,
  context?: Record<string, unknown>
): void {
  if (context) {
    Sentry.setContext('additional', context);
  }
  Sentry.captureException(error);
}

/**
 * Log a breadcrumb for debugging.
 */
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    category,
    message,
    data,
    level: 'info',
  });
}

/**
 * Wrap the root App component with Sentry error boundary.
 */
export const SentryWrap = Sentry.wrap;
