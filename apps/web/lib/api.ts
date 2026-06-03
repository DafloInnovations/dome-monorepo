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

// ─── Server-side fetch (no localStorage, accepts explicit token) ──────────────
export async function serverFetch<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new ApiError(body.message ?? `HTTP ${res.status}`, res.status);
  }
  return res.json() as Promise<T>;
}

// ─── Domain types ──────────────────────────────────────────────────────────────

export interface FacilityAddress {
  street: string;
  city: string;
  province: string;
  postalCode: string;
  lat: number | null;
  lng: number | null;
}

export interface Facility {
  id: string;
  name: string;
  sport: string;
  surface: string;
  capacity: number;
  images: string[];
  isActive: boolean;
  description: string;
  address: FacilityAddress | null;
  amenities: Array<{ amenity: { id: string; name: string; iconSlug?: string | null } }>;
  courts: Array<{ id: string; name: string; isActive: boolean }>;
  averageRating: number | null;
  totalReviews: number;
  _count?: { bookings: number };
}

export interface Slot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  priceCAD: number;
  status: "AVAILABLE" | "BOOKED" | "HELD" | "BLOCKED" | "OPEN_GAME";
  courtId: string | null;
  capacity: number | null;
  spotsBooked: number;
}

export interface Booking {
  id: string;
  status: string;
  paymentStatus: string;
  totalCAD: number;
  subtotalCAD: number;
  taxCAD: number;
  createdAt: string;
  slot: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    court: { name: string } | null;
  };
  facility: { id: string; name: string; sport: string; address?: FacilityAddress | null };
}

export interface Review {
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
  user: { firstName: string; lastName: string; avatarUrl: string | null };
  booking?: { slot: { date: string } };
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
  facility: { id: string; name: string; address?: FacilityAddress | null };
  _count: { participants: number };
}

export interface UserProfile {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  province: string;
  creditBalanceCAD: number;
  createdAt: string;
}
