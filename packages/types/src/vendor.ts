import type { CanadianProvince } from "./user";

export type VendorStatus = "pending" | "approved" | "suspended" | "rejected";

export interface VendorBankInfo {
  transitNumber: string;
  institutionNumber: string;
  accountNumber: string;
}

export interface Vendor {
  id: string;
  userId: string;
  businessName: string;
  businessNumber?: string;
  gstHstNumber?: string;
  province: CanadianProvince;
  status: VendorStatus;
  stripeAccountId?: string;
  stripeOnboardingComplete: boolean;
  logoUrl?: string;
  website?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVendorInput {
  businessName: string;
  businessNumber?: string;
  gstHstNumber?: string;
  province: CanadianProvince;
  website?: string;
}

export interface UpdateVendorInput {
  businessName?: string;
  gstHstNumber?: string;
  logoUrl?: string;
  website?: string;
}

export interface VendorEarnings {
  periodStart: string;
  periodEnd: string;
  grossCAD: number;
  platformFeeCAD: number;
  stripeFeeCAD: number;
  netCAD: number;
  payoutCount: number;
}
