import type {
  CreateVendorInput,
  UpdateVendorInput,
  Vendor,
  VendorEarnings,
} from "@dome/types";
import type { Fetcher } from "../fetcher";

export class VendorsResource {
  constructor(private readonly fetch: Fetcher) {}

  me(): Promise<Vendor> {
    return this.fetch("/vendors/me");
  }

  create(input: CreateVendorInput): Promise<Vendor> {
    return this.fetch("/vendors", { method: "POST", body: input });
  }

  update(input: UpdateVendorInput): Promise<Vendor> {
    return this.fetch("/vendors/me", { method: "PUT", body: input });
  }

  stripeOnboardingLink(): Promise<{ url: string }> {
    return this.fetch("/vendors/me/stripe-onboarding", { method: "POST" });
  }

  earnings(from: string, to: string): Promise<VendorEarnings> {
    return this.fetch("/vendors/me/earnings", { params: { from, to } });
  }
}
