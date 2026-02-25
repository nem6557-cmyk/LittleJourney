import React from 'react';
import { StripeProvider } from '@stripe/stripe-react-native';
import { stripeConfig } from '../lib/stripe';

/**
 * Native StripeProvider wrapper.
 * On web, StripeWrapper.web.tsx is used instead (no-op passthrough).
 */
export function StripeWrapper({ children }: { children: React.ReactNode }) {
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
