import { useCallback, useEffect, useState } from "react";
import { useAuthToken } from "./useAuthToken";

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";

export interface Tier {
  name: string;
  min: number;
  max: number;
}

export interface ProfileUser {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: string;
  province: string;
  creditBalanceCAD: number;
}

export interface ProfileStats {
  totalGames: number;
  totalHours: number;
  totalPoints: number;
  currentStreak: number;
  tier: string; // uppercase string from API: "BEGINNER", "ROOKIE", etc.
  sportBreakdown: Record<string, number>;
}

export interface MyProfile {
  user: ProfileUser;
  stats: ProfileStats;
}

export function useMyProfile() {
  const { getValidToken, checkResponse } = useAuthToken();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = await getValidToken();
      const res = await fetch(`${API_URL}/users/me/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await checkResponse(res);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data: MyProfile };
      setProfile(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  }, [getValidToken, checkResponse]);

  // Empty deps: fetch once on mount. Subsequent fetches are triggered
  // explicitly via refetch() (pull-to-refresh, screen focus, etc.).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchProfile(); }, []);

  return { profile, isLoading, error, refetch: fetchProfile };
}
