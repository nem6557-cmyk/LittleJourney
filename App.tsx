import 'react-native-url-polyfill/auto';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import { AppProvider } from './src/context/AppContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { StripeWrapper } from './src/components/StripeWrapper';
import { AppNavigator } from './src/navigation/AppNavigator';
import { initSentry, SentryWrap } from './src/lib/sentry';
import { trackEvent, AnalyticsEvents } from './src/lib/analytics';

// #23: Initialize Sentry early before rendering
initSentry();

/**
 * Provider hierarchy (outermost → innermost):
 * 1. ErrorBoundary — catches runtime errors
 * 2. StripeProvider — Stripe payment sheet (#4)
 * 3. ThemeProvider — dark/light mode
 * 4. AuthProvider — Supabase auth session, profile, daycare
 * 5. AppProvider — app state (children, timeline, messages, etc.)
 * 6. AppNavigator — routing based on auth state
 */
function App() {
  useEffect(() => {
    trackEvent(AnalyticsEvents.APP_OPENED);
  }, []);

  return (
    <ErrorBoundary>
      <StripeWrapper>
        <ThemeProvider>
          <AuthProvider>
            <AppProvider>
              <StatusBar style="light" />
              <AppNavigator />
            </AppProvider>
          </AuthProvider>
        </ThemeProvider>
      </StripeWrapper>
    </ErrorBoundary>
  );
}

// #23: Wrap with Sentry for automatic error boundary tracking
export default SentryWrap(App);
