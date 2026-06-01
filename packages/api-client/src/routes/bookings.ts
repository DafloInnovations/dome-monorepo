import type {
  Booking,
  BookingListFilters,
  CancelBookingInput,
  CreateBookingInput,
  PaginatedResponse,
} from "@dome/types";
import type { Fetcher } from "../fetcher";

export class BookingsResource {
  constructor(private readonly fetch: Fetcher) {}

  list(filters?: BookingListFilters): Promise<PaginatedResponse<Booking>> {
    return this.fetch("/bookings", { params: filters as Record<string, string> });
  }

  get(id: string): Promise<Booking> {
    return this.fetch(`/bookings/${id}`);
  }

  create(input: CreateBookingInput): Promise<Booking> {
    return this.fetch("/bookings", { method: "POST", body: input });
  }

  cancel(id: string, input?: CancelBookingInput): Promise<Booking> {
    return this.fetch(`/bookings/${id}/cancel`, { method: "PUT", body: input });
  }

  complete(id: string): Promise<Booking> {
    return this.fetch(`/bookings/${id}/complete`, { method: "PUT" });
  }

  markNoShow(id: string): Promise<Booking> {
    return this.fetch(`/bookings/${id}/no-show`, { method: "PUT" });
  }
}
