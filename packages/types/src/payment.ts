export type PaymentMethod =
  | "card"
  | "apple-pay"
  | "google-pay"
  | "interac-etransfer";

export type PaymentGateway = "stripe";

export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded";

export interface Payment {
  id: string;
  bookingId: string;
  userId: string;
  amountCAD: number;
  taxCAD: number;
  method: PaymentMethod;
  gateway: PaymentGateway;
  gatewayPaymentId: string;
  gatewayCustomerId?: string;
  status: PaymentStatus;
  refundedAt?: string;
  refundAmountCAD?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentIntentInput {
  bookingId: string;
}

export interface PaymentIntent {
  clientSecret: string;
  paymentIntentId: string;
  amountCAD: number;
  taxCAD: number;
  totalCAD: number;
}

export interface ConfirmPaymentInput {
  paymentIntentId: string;
  bookingId: string;
}
