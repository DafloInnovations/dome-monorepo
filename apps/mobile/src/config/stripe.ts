export const STRIPE_PUBLISHABLE_KEY =
  process.env["EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY"] ?? "";

export function isStripeConfigured() {
  return STRIPE_PUBLISHABLE_KEY.startsWith("pk_");
}
