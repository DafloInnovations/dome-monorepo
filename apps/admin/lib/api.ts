import { getToken } from "./auth";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
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
