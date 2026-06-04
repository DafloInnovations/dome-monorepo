import { useCallback, useEffect, useState } from "react";
import { useAuthToken } from "./useAuthToken";

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";

export interface GameHost {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

export interface GameFacility {
  id: string;
  name: string;
  address: { street: string; city: string; province: string; lat: number | null; lng: number | null } | null;
}

export interface GameParticipant {
  id: string;
  userId: string;
  status: "PENDING" | "CONFIRMED" | "DECLINED";
  joinedAt: string;
  confirmedAt: string | null;
  user: GameHost;
}

export interface OpenGame {
  id: string;
  hostUserId: string;
  sport: string;
  skillLevel: string;
  gameDate: string | null;   // YYYY-MM-DD
  startTime: string | null;
  endTime: string | null;
  playersNeeded: number | null;
  playersConfirmed: number;
  spotsLeft: number | null;
  description: string | null;
  status: string;
  host: GameHost;
  facility: GameFacility;
  participants?: Pick<GameParticipant, "id" | "userId" | "status">[];
  distanceKm?: number;
}

export interface OpenGameDetail extends OpenGame {
  participants: GameParticipant[];
}

export interface GamesFilter {
  sport?: string;
  date?: string;
  city?: string;
  lat?: number;
  lng?: number;
}

export interface CreateGamePayload {
  facilityId: string;
  slotId?: string;
  sport: string;
  gameDate: string;
  startTime: string;
  endTime: string;
  playersNeeded: number;
  skillLevel: string;
  description?: string;
}

// ─── Feed hook ────────────────────────────────────────────────────────────────

export function useGames(filter: GamesFilter = {}) {
  const [games, setGames] = useState<OpenGame[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGames = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filter.sport) params.set("sport", filter.sport);
      if (filter.date) params.set("date", filter.date);
      if (filter.city) params.set("city", filter.city);
      if (filter.lat != null) params.set("lat", String(filter.lat));
      if (filter.lng != null) params.set("lng", String(filter.lng));

      const res = await fetch(`${API_URL}/connect/games?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data: OpenGame[] };
      setGames(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load games");
    } finally {
      setIsLoading(false);
    }
  }, [filter.sport, filter.date, filter.city, filter.lat, filter.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchGames(); }, [fetchGames]);

  return { games, isLoading, error, refetch: fetchGames };
}

// ─── Detail hook ──────────────────────────────────────────────────────────────

export function useGameDetail(gameId: string) {
  const [game, setGame] = useState<OpenGameDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGame = useCallback(async () => {
    if (!gameId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/connect/games/${gameId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data: OpenGameDetail };
      setGame(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load game");
    } finally {
      setIsLoading(false);
    }
  }, [gameId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchGame(); }, []);

  return { game, isLoading, error, refetch: fetchGame };
}

// ─── Actions hook ─────────────────────────────────────────────────────────────

export function useConnectActions() {
  const { getValidToken, checkResponse } = useAuthToken();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function postGame(payload: CreateGamePayload): Promise<OpenGameDetail> {
    setIsLoading(true);
    setError(null);
    try {
      const token = await getValidToken();
      const res = await fetch(`${API_URL}/connect/games`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      await checkResponse(res);
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { data: OpenGameDetail };
      return json.data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to post game";
      setError(msg);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }

  async function joinGame(gameId: string): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      const token = await getValidToken();
      const res = await fetch(`${API_URL}/connect/games/${gameId}/join`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      await checkResponse(res);
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to join game";
      setError(msg);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }

  async function confirmPlayer(gameId: string, userId: string): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      const token = await getValidToken();
      const res = await fetch(`${API_URL}/connect/games/${gameId}/players/${userId}/confirm`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      await checkResponse(res);
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to confirm player";
      setError(msg);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }

  async function declinePlayer(gameId: string, userId: string): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      const token = await getValidToken();
      const res = await fetch(`${API_URL}/connect/games/${gameId}/players/${userId}/decline`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      await checkResponse(res);
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to decline player";
      setError(msg);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }

  return { postGame, joinGame, confirmPlayer, declinePlayer, isLoading, error };
}
