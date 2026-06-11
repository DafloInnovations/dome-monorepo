import {
  clearToken,
  getRefreshToken,
  getToken,
  isTokenExpiringSoon,
  setRefreshToken,
  setToken,
} from "./auth";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

function buildHeaders(token: string | null, extra?: HeadersInit): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extra ?? {}),
  };
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

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const isAuthPath = path.startsWith("/auth/");

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
      const retry = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: buildHeaders(newToken, options?.headers),
      });
      if (!retry.ok) {
        const retryBody = await retry.json().catch(() => ({})) as { message?: string };
        throw new ApiError(retryBody.message ?? `HTTP ${retry.status}`, retry.status);
      }
      return (retry.status === 204 ? undefined : await retry.json()) as T;
    }

    throw new ApiError(body.message ?? `HTTP ${res.status}`, res.status);
  }

  return (res.status === 204 ? undefined : await res.json()) as T;
}

// ─── Domain types ──────────────────────────────────────────────────────────────

export interface PlatformStats {
  totalUsers: number;
  totalVendors: number;
  pendingVendors: number;
  totalBookingsToday: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  totalRevenueMonth: number;
}

export interface AdminVendor {
  id: string;
  businessName: string;
  businessEmail: string | null;
  businessPhone: string | null;
  website: string | null;
  description: string | null;
  streetAddress: string | null;
  city: string | null;
  province: string;
  postalCode: string | null;
  sports: string[];
  status: string;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  user: { id: string; phone: string; firstName: string; lastName: string; province?: string; createdAt?: string };
  _count?: { facilities: number };
  facilities?: Array<{ id: string; name: string; sport: string; isActive: boolean; _count: { bookings: number } }>;
}

export interface AdminUser {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  role: string;
  province: string;
  creditBalanceCAD: number;
  createdAt: string;
  _count?: { bookings: number };
  vendor?: { id: string; businessName: string; status: string } | null;
  bookings?: AdminBooking[];
  domeCredits?: Array<{ id: string; amountCAD: number; reason: string; createdAt: string }>;
}

export interface AdminBooking {
  id: string;
  status: string;
  totalCAD: number;
  subtotalCAD: number;
  taxCAD: number;
  createdAt: string;
  slot: { date: string; startTime: string; endTime: string; court?: { name: string } | null };
  facility: { id: string; name: string; sport: string; address?: { city: string } | null };
  user: { id: string; phone: string; firstName: string; lastName: string };
  payment?: { status: string; amountCAD: number } | null;
}

export interface ActivityEvent {
  id: string;
  type: "user_signup" | "booking_created" | "booking_cancelled" | "vendor_applied";
  title: string;
  sub: string;
  createdAt: string;
  href?: string;
}

export interface RevenueData {
  totalRevenueAllTime: number;
  totalRevenueMonth: number;
  domeCommission: number;
  totalBookings: number;
  revenueByDay: Array<{ date: string; amount: number }>;
  revenueByCity: Array<{ city: string; amount: number }>;
  revenueBySport: Array<{ sport: string; amount: number }>;
  topVendors: Array<{ vendorId: string; businessName: string; amount: number; bookings: number }>;
}

export interface AdminReview {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  sport: string;
  isVerified: boolean;
  isVisible: boolean;
  vendorReply: string | null;
  flaggedAt: string | null;
  flagReason: string | null;
  createdAt: string;
  user: { firstName: string; lastName: string };
  facility: { id: string; name: string };
}

export interface AdminReviewsResponse {
  reviews: AdminReview[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
