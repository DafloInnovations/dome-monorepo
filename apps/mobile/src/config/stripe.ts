import { Platform } from "react-native";

export const STRIPE_PUBLISHABLE_KEY =
  process.env["EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY"] ?? "";

export function isStripeConfigured() {
  return Platform.OS !== "web" && STRIPE_PUBLISHABLE_KEY.startsWith("pk_");
}
