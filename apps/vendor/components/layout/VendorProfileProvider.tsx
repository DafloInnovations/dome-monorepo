"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { api, getStoredUser, type VendorProfile } from "../../lib/api";

const PROFILE_KEY = "dome_vendor_profile";
const BUSINESS_NAME_KEY = "businessName";
const FALLBACK_NAME = "Vendor Portal";

interface VendorProfileContextValue {
  profile: VendorProfile | null;
  businessName: string;
  initials: string;
  statusLabel: string;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const VendorProfileContext = createContext<VendorProfileContextValue | null>(null);

function getInitials(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0 || name === FALLBACK_NAME) return "VP";

  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function getStatusLabel(status?: string) {
  const normalized = status?.toUpperCase();
  if (normalized === "APPROVED" || normalized === "ACTIVE") return "Active vendor";
  if (normalized === "PENDING") return "Pending vendor";
  if (normalized === "REJECTED") return "Rejected vendor";
  return "Active vendor";
}

function readCachedProfile(): VendorProfile | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return JSON.parse(raw) as VendorProfile;
  } catch {}

  const businessName =
    localStorage.getItem(BUSINESS_NAME_KEY) ?? getStoredUser()?.businessName;

  return businessName ? { businessName } : null;
}

function cacheProfile(profile: VendorProfile) {
  if (typeof window === "undefined") return;

  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  if (profile.businessName) {
    localStorage.setItem(BUSINESS_NAME_KEY, profile.businessName);
  }
}

export function VendorProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.vendor.profile();
      cacheProfile(response.data);
      setProfile(response.data);
    } catch {
      setProfile((current) => current ?? readCachedProfile());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setProfile(readCachedProfile());
    void refresh();
  }, [refresh]);

  const value = useMemo(() => {
    const businessName = profile?.businessName || FALLBACK_NAME;

    return {
      profile,
      businessName,
      initials: getInitials(businessName),
      statusLabel: getStatusLabel(profile?.status),
      isLoading,
      refresh,
    };
  }, [isLoading, profile, refresh]);

  return (
    <VendorProfileContext.Provider value={value}>
      {children}
    </VendorProfileContext.Provider>
  );
}

export function useVendorProfile() {
  const context = useContext(VendorProfileContext);
  if (!context) {
    const cached = readCachedProfile();
    const businessName = cached?.businessName || FALLBACK_NAME;

    return {
      profile: cached,
      businessName,
      initials: getInitials(businessName),
      statusLabel: getStatusLabel(cached?.status),
      isLoading: false,
      refresh: async () => {},
    };
  }

  return context;
}
