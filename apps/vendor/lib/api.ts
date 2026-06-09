const API_URL =
  process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";

const TOKEN_KEY         = "dome_vendor_token";
const REFRESH_TOKEN_KEY = "dome_vendor_refresh_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string) {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem("dome_vendor_user");
  localStorage.removeItem("dome_vendor_profile");
  localStorage.removeItem("businessName");
}

export function isTokenExpiringSoon(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]!)) as { exp?: number };
    const expiresIn = (payload.exp ?? 0) - Date.now() / 1000;
    return expiresIn < 30 * 60; // less than 30 minutes
  } catch {
    return true;
  }
}

export async function doRefreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearToken();
    if (typeof window !== "undefined" && window.location.pathname !== "/") {
      window.location.href = "/";
    }
    return null;
  }
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      clearToken();
      if (typeof window !== "undefined" && window.location.pathname !== "/") {
        window.location.href = "/";
      }
      return null;
    }
    const data = await res.json() as { data: { accessToken: string; refreshToken: string } };
    setToken(data.data.accessToken);
    setRefreshToken(data.data.refreshToken);
    return data.data.accessToken;
  } catch {
    return null;
  }
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

export interface VendorProfile {
  id?: string;
  businessName: string;
  status?: string;
  city?: string;
  sports?: string[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

function buildHeaders(token: string | null, extra?: HeadersInit): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extra ?? {}),
  };
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const isAuthPath = path.startsWith("/auth/");

  // Proactively refresh if the token expires within 30 minutes
  if (!isAuthPath) {
    const token = getToken();
    if (token && isTokenExpiringSoon(token)) {
      await doRefreshAccessToken();
    }
  }

  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: buildHeaders(token, options?.headers),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };

    if (res.status === 401 && !isAuthPath) {
      const newToken = await doRefreshAccessToken();
      if (!newToken) {
        throw new ApiError("Session expired. Please sign in again.", 401);
      }
      // Retry once with the fresh token
      const retry = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: buildHeaders(newToken, options?.headers),
      });
      if (!retry.ok) {
        const retryBody = await retry.json().catch(() => ({})) as { message?: string };
        throw new ApiError(retryBody.message ?? `HTTP ${retry.status}`, retry.status);
      }
      return retry.json() as Promise<T>;
    }

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
    profile: () =>
      apiFetch<{ data: VendorProfile }>("/vendor/profile"),
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
    deleteSlot: (slotId: string) =>
      apiFetch<void>(`/vendor/slots/${slotId}`, { method: "DELETE" }),
    bulkDeleteSlots: (slotIds: string[]) =>
      apiFetch<{ data: { deleted: number; skipped: number } }>("/vendor/slots/bulk", {
        method: "DELETE",
        body: JSON.stringify({ slotIds }),
      }),
    updateSlot: (slotId: string, body: { priceCAD?: number; status?: string }) =>
      apiFetch<{ data: Slot }>(`/vendor/slots/${slotId}`, { method: "PUT", body: JSON.stringify(body) }),
    blockSlot: (slotId: string) =>
      apiFetch<{ data: Slot }>(`/vendor/slots/${slotId}/block`, { method: "PUT" }),
    unblockSlot: (slotId: string) =>
      apiFetch<{ data: Slot }>(`/vendor/slots/${slotId}/unblock`, { method: "PUT" }),
    connectGames: () =>
      apiFetch<{ data: OpenGame[] }>("/vendor/connect/games"),
  },
  equipment: {
    list: () => apiFetch<{ data: VendorEquipment[] }>("/vendor/equipment"),
    create: (facilityId: string, body: VendorEquipmentInput) =>
      apiFetch<{ data: VendorEquipment }>(`/vendor/facilities/${facilityId}/equipment`, { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: Partial<VendorEquipmentInput> & { isActive?: boolean }) =>
      apiFetch<{ data: VendorEquipment }>(`/vendor/equipment/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    remove: (id: string) =>
      apiFetch<void>(`/vendor/equipment/${id}`, { method: "DELETE" }),
  },
  reviews: {
    list: (params?: Record<string, string>) => {
      const qs = params ? "?" + new URLSearchParams(params).toString() : "";
      return apiFetch<{ data: VendorReviewsResponse }>(`/reviews/vendor${qs}`);
    },
    reply: (reviewId: string, reply: string) =>
      apiFetch<{ data: VendorReview }>(`/reviews/${reviewId}/reply`, {
        method: "POST",
        body: JSON.stringify({ reply }),
      }),
  },
  walkin: {
    price: (params: { courtId: string; date: string; startTime: string; durationMinutes: number; sport: string }) =>
      apiFetch<{ data: WalkinPrice }>(`/vendor/walkin/price?${new URLSearchParams({ ...params, durationMinutes: String(params.durationMinutes) }).toString()}`),
    create: (body: WalkinCreateBody) =>
      apiFetch<{ data: WalkinCreated }>("/vendor/walkin", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    status: (bookingId: string) =>
      apiFetch<{ data: { status: "PENDING" | "PAID" | "EXPIRED" } }>(`/vendor/walkin/${bookingId}/status`),
    history: () =>
      apiFetch<{ data: WalkinHistory }>("/vendor/walkin/history"),
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
  courts: { id: string; name: string; isActive: boolean; sports: string[]; primarySport: string | null }[];
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

export interface VendorReview {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  sport: string;
  courtQuality: number | null;
  cleanliness: number | null;
  valueForMoney: number | null;
  staffFriendly: number | null;
  vendorReply: string | null;
  vendorRepliedAt: string | null;
  isVerified: boolean;
  createdAt: string;
  user: { firstName: string; lastName: string };
  facility: { id: string; name: string };
  booking: { slot: { date: string } };
}

export interface VendorReviewsResponse {
  reviews: VendorReview[];
  total: number;
  unanswered: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface VendorEquipmentInput {
  name: string;
  description?: string | null;
  sport: string;
  priceCAD: number;
  quantity: number;
  imageUrl?: string | null;
}

export interface VendorEquipment {
  id: string;
  facilityId: string;
  name: string;
  description: string | null;
  sport: string;
  priceCAD: number;
  quantity: number;
  isActive: boolean;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  facility: { id: string; name: string };
  _count: { rentals: number };
}

export interface WalkinPrice {
  basePriceCAD: number;
  subtotalCAD: number;
  taxCAD: number;
  totalCAD: number;
  appliedRule: string | null;
  taxRate: number;
  province: string;
}

export interface WalkinCreateBody {
  courtId: string;
  facilityId: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  sport: string;
  playerName?: string;
  playerPhone?: string;
}

export interface WalkinCreated {
  bookingId: string;
  paymentLinkUrl: string;
  qrCodeDataUrl: string;
  totalCAD: number;
  subtotalCAD: number;
  taxCAD: number;
  sport: string;
  courtName: string;
  facilityName: string;
  startTime: string;
  endTime: string;
  date: string;
  playerName: string;
  expiresAt: string;
}

export interface WalkinBookingSummary {
  id: string;
  notes: string | null;
  totalCAD: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
}

export interface WalkinHistory {
  bookings: WalkinBookingSummary[];
  totalRevenue: number;
  count: number;
}

export interface CourtWithSports {
  id: string;
  name: string;
  isActive: boolean;
  sports: string[];
  primarySport: string | null;
}
