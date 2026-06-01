import type {
  ConfirmPaymentInput,
  CreatePaymentIntentInput,
  Payment,
  PaymentIntent,
} from "@dome/types";
import type { Fetcher } from "../fetcher";

export class PaymentsResource {
  constructor(private readonly fetch: Fetcher) {}

  createIntent(input: CreatePaymentIntentInput): Promise<PaymentIntent> {
    return this.fetch("/payments/intent", { method: "POST", body: input });
  }

  confirm(input: ConfirmPaymentInput): Promise<Payment> {
    return this.fetch("/payments/confirm", { method: "POST", body: input });
  }

  get(id: string): Promise<Payment> {
    return this.fetch(`/payments/${id}`);
  }

  refund(id: string): Promise<Payment> {
    return this.fetch(`/payments/${id}/refund`, { method: "POST" });
  }
}
