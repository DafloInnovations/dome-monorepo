const API_URL =
  process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("dome_vendor_token");
}

export function setToken(token: string) {
  localStorage.setItem("dome_vendor_token", token);
}

export function clearToken() {
  localStorage.removeItem("dome_vendor_token");
  localStorage.removeItem("dome_vendor_user");
}

export function getStoredUser(): VendorUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("dome_vendor_user");
    return raw ? (JSON.parse(raw) as VendorUser) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: VendorUser) {
  localStorage.setItem("dome_vendor_user", JSON.stringify(user));
}

export interface VendorUser {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  role: string;
  businessName?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new ApiError(body.message ?? `HTTP ${res.status}`, res.status);
  }

  return res.json() as Promise<T>;
}

// ─── Typed helpers ────────────────────────────────────────────────────────────

export const api = {
  auth: {
    sendOtp: (phone: string) =>
      apiFetch<{ data: { message: string } }>("/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({ phone }),
      }),
    verifyOtp: (phone: string, code: string) =>
      apiFetch<{
        data: { accessToken: string; refreshToken: string; user: VendorUser };
      }>("/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ phone, code }),
      }),
  },
  vendor: {
    analytics: () =>
      apiFetch<{ data: AnalyticsData }>("/vendor/analytics"),
    facilities: () =>
      apiFetch<{ data: Facility[] }>("/vendor/facilities"),
    bookings: (params?: Record<string, string>) => {
      const qs = params ? "?" + new URLSearchParams(params).toString() : "";
      return apiFetch<{ data: Booking[]; total: number }>(`/vendor/bookings${qs}`);
    },
    courtSlots: (courtId: string, from?: string) => {
      const qs = from ? `?from=${from}` : "";
      return apiFetch<{ data: Slot[] }>(`/vendor/courts/${courtId}/slots${qs}`);
    },
    cancelBooking: (bookingId: string) =>
      apiFetch<{ data: Booking }>(`/vendor/bookings/${bookingId}/cancel`, { method: "PUT" }),
    blockSlots: (body: { courtId: string; startDate: string; endDate: string; reason?: string }) =>
      apiFetch<{ data: { blocked: number } }>("/vendor/slots/block", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    connectGames: () =>
      apiFetch<{ data: OpenGame[] }>("/vendor/connect/games"),
  },
};

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface AnalyticsData {
  revenueByDay: { date: string; amount: number }[];
  bookingsByDay: { date: string; count: number }[];
  totalRevenueMonth: number;
  totalBookingsMonth: number;
  avgBookingValue: number;
  todayBookings: number;
  overallOccupancyRate: number;
  occupancyRateByCourt: {
    courtId: string;
    courtName: string;
    totalSlots: number;
    bookedSlots: number;
    occupancyRate: number;
  }[];
  topSports: { sport: string; count: number }[];
  peakHours: { hour: number; count: number }[];
  cancellationRate: number;
}

export interface OpenGame {
  id: string;
  sport: string;
  gameDate: string;
  startTime: string;
  endTime: string;
  playersNeeded: number;
  skillLevel: string;
  description?: string;
  status: string;
  host: { id: string; firstName: string; lastName: string };
  facility: { id: string; name: string };
  _count: { participants: number };
}

export interface Facility {
  id: string;
  name: string;
  sport: string;
  isActive: boolean;
  courts: { id: string; name: string; isActive: boolean }[];
  address: { city: string; street: string; province: string } | null;
  _count: { bookings: number };
}

export interface Booking {
  id: string;
  status: string;
  totalCAD: number;
  createdAt: string;
  slot: {
    date: string;
    startTime: string;
    endTime: string;
    court: { name: string } | null;
  };
  facility: { name: string; sport: string };
  user: { id: string; firstName: string; lastName: string; phone: string };
  payment: { status: string; amountCAD: number; method: string } | null;
}

export interface Slot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  priceCAD: number;
  status: string;
}
