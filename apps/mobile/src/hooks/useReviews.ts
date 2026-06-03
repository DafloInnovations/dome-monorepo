import { useCallback, useState } from "react";
import { useAuthToken } from "./useAuthToken";

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";

export interface ReviewUser {
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

export interface ReviewSummary {
  averageRating: number | null;
  totalReviews: number;
  distribution: Record<number, number>;
  subRatings: {
    courtQuality: number | null;
    cleanliness: number | null;
    valueForMoney: number | null;
    staffFriendly: number | null;
  };
}

export interface FacilityReview {
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
  user: ReviewUser;
  booking: { slot: { date: string } };
}

export interface CreateReviewData {
  bookingId: string;
  rating: number;
  title?: string | null;
  body?: string | null;
  courtQuality?: number | null;
  cleanliness?: number | null;
  valueForMoney?: number | null;
  staffFriendly?: number | null;
}

export function useReviews() {
  const { getValidToken } = useAuthToken();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createReview = useCallback(
    async (data: CreateReviewData): Promise<FacilityReview> => {
      const token = await getValidToken();
      const res = await fetch(`${API_URL}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      const json = (await res.json()) as { data: FacilityReview; message?: string };
      if (!res.ok) throw new Error(json.message ?? `HTTP ${res.status}`);
      return json.data;
    },
    [getValidToken]
  );

  const fetchFacilityReviews = useCallback(
    async (
      facilityId: string,
      options: { page?: number; limit?: number; sort?: string } = {}
    ): Promise<{ reviews: FacilityReview[]; summary: ReviewSummary; hasMore: boolean; total: number }> => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (options.page) qs.set("page", String(options.page));
        if (options.limit) qs.set("limit", String(options.limit));
        if (options.sort) qs.set("sort", options.sort);

        const res = await fetch(`${API_URL}/reviews/facility/${facilityId}?${qs}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as {
          data: { reviews: FacilityReview[]; summary: ReviewSummary; hasMore: boolean; total: number };
        };
        return json.data;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load reviews");
        return { reviews: [], summary: { averageRating: null, totalReviews: 0, distribution: {}, subRatings: { courtQuality: null, cleanliness: null, valueForMoney: null, staffFriendly: null } }, hasMore: false, total: 0 };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const fetchPendingReviews = useCallback(async () => {
    const token = await getValidToken();
    const res = await fetch(`${API_URL}/reviews/pending`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data: unknown[] };
    return json.data;
  }, [getValidToken]);

  const fetchMyReviews = useCallback(async (): Promise<FacilityReview[]> => {
    const token = await getValidToken();
    const res = await fetch(`${API_URL}/reviews/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data: FacilityReview[] };
    return json.data;
  }, [getValidToken]);

  return { loading, error, createReview, fetchFacilityReviews, fetchPendingReviews, fetchMyReviews };
}
