import { useCallback, useEffect, useState } from "react";

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";

export interface ActiveCoupon {
  code: string;
  type: string;
  value: number;
  description: string | null;
  validUntil: string;
  maxDiscountCAD: number | null;
}

export interface Facility {
  id: string;
  name: string;
  description: string;
  sport: string;
  surface: string;
  capacity: number;
  images: string[];
  isActive: boolean;
  address: {
    street: string;
    city: string;
    province: string;
    postalCode: string;
    lat: number | null;
    lng: number | null;
  } | null;
  averageRating: number | null;
  totalReviews: number;
  distanceKm?: number;
  activeCoupons?: ActiveCoupon[];
}

interface UseFacilitiesOpts {
  lat?: number;
  lng?: number;
  radius?: number;
  sport?: string;
  hasOffers?: boolean;
}

export function useFacilities(opts: UseFacilitiesOpts = {}) {
  const { lat, lng, radius = 10, sport, hasOffers } = opts;
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFacilities = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (lat !== undefined && lng !== undefined) {
        params.set("lat", String(lat));
        params.set("lng", String(lng));
        params.set("radius", String(radius));
      }
      if (sport) params.set("sport", sport);
      if (hasOffers) params.set("hasOffers", "true");

      const query = params.toString();
      const res = await fetch(`${API_URL}/facilities${query ? `?${query}` : ""}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data: Facility[] };
      setFacilities(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load facilities");
    } finally {
      setIsLoading(false);
    }
  }, [lat, lng, radius, sport, hasOffers]);

  useEffect(() => {
    fetchFacilities();
  }, [fetchFacilities]);

  return { facilities, isLoading, error, refetch: fetchFacilities };
}
