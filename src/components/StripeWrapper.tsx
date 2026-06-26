import React from 'react';
import { StripeProvider } from '@stripe/stripe-react-native';
import { stripeConfig } from '../lib/stripe';

/**
 * Native StripeProvider wrapper.
 * On web, StripeWrapper.web.tsx is used instead (no-op passthrough).
 */
export function StripeWrapper({ children }: { children: React.ReactNode }) {
  // An empty/invalid publishable key makes StripeProvider throw at startup.
  // If Stripe isn't configured for this build, render children unwrapped so the
  // app still boots (payment screens guard themselves on the missing key).
  if (!stripeConfig.publishableKey) {
    return <>{children}</>;
  }

  return (
    <StripeProvider
      publishableKey={stripeConfig.publishableKey}
      merchantIdentifier={stripeConfig.merchantIdentifier}
      urlScheme={stripeConfig.urlScheme}
    >
      {children as React.ReactElement}
    </StripeProvider>
  );
}
