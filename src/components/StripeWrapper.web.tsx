import React from 'react';

/**
 * Web stub — @stripe/stripe-react-native does not support web.
 * Simply passes children through without wrapping in StripeProvider.
 */
export function StripeWrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
