import type { Facility } from "./facility";
import type { Slot } from "./slot";
import type { User } from "./user";

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no-show";

export type PaymentStatus = "unpaid" | "paid" | "refunded" | "partial";

export interface Booking {
  id: string;
  slotId: string;
  facilityId: string;
  userId: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  subtotalCAD: number;
  taxCAD: number;
  totalCAD: number;
  taxProvince: string;
  notes?: string;
  slot?: Slot;
  user?: User;
  facility?: Facility;
  cancelledAt?: string;
  cancelReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBookingInput {
  slotId: string;
  facilityId: string;
  notes?: string;
}

export interface CancelBookingInput {
  reason?: string;
}

export interface BookingListFilters {
  status?: BookingStatus;
  facilityId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}
