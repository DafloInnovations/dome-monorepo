import type { ReactNode } from "react";

type StripeError = { code: string; message: string };

const WEB_STRIPE_ERROR: StripeError = {
  code: "UnsupportedPlatform",
  message: "Stripe payments are only available in the native iOS/Android app.",
};

export function StripeProvider({ children }: { children: ReactNode; publishableKey?: string }) {
  return <>{children}</>;
}

export function useStripe() {
  return {
    initPaymentSheet: async () => ({ error: WEB_STRIPE_ERROR }),
    presentPaymentSheet: async () => ({ error: WEB_STRIPE_ERROR }),
  };
}
