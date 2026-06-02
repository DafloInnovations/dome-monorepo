import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";

const KEY_ACCESS = "dome_access_token";
const KEY_REFRESH = "dome_refresh_token";

export interface AuthUser {
  id: string;
  phone: string;
  role: string;
  firstName?: string;
  lastName?: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
}

interface AuthActions {
  setSession: (at: string, rt: string, user: AuthUser) => Promise<void>;
  clearSession: () => Promise<void>;
  /** Call after any API response. Logs out automatically on 404 "user not found". */
  handleApiError: (status: number, message?: string) => Promise<void>;
}

const AuthContext = createContext<(AuthState & AuthActions) | null>(null);

function parseJwt(token: string): Record<string, unknown> | null {
  try {
    return JSON.parse(atob(token.split(".")[1]!));
  } catch {
    return null;
  }
}

const API_URL =
  process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    hydrate();
  }, []);

  async function hydrate() {
    try {
      const [at, rt] = await Promise.all([
        SecureStore.getItemAsync(KEY_ACCESS),
        SecureStore.getItemAsync(KEY_REFRESH),
      ]);

      if (at) {
        const payload = parseJwt(at);
        const isValid =
          payload &&
          typeof payload["exp"] === "number" &&
          payload["exp"] * 1000 > Date.now();

        if (isValid) {
          setAccessToken(at);
          setRefreshToken(rt);
          setUser({
            id: String(payload["sub"]),
            phone: "",
            role: String(payload["role"]),
          });
          return;
        }
      }

      if (rt) await attemptRefresh(rt);
    } catch {
      await clearSession();
    } finally {
      setIsLoading(false);
    }
  }

  // All three exported functions only use React setState dispatchers (guaranteed
  // stable by React) and SecureStore (module-level stable), so useCallback([])
  // is correct — no real deps, no stale-closure risk.

  const clearSession = useCallback(async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(KEY_ACCESS),
      SecureStore.deleteItemAsync(KEY_REFRESH),
    ]);
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
  }, []);

  const setSession = useCallback(async (at: string, rt: string, u: AuthUser) => {
    await Promise.all([
      SecureStore.setItemAsync(KEY_ACCESS, at),
      SecureStore.setItemAsync(KEY_REFRESH, rt),
    ]);
    setAccessToken(at);
    setRefreshToken(rt);
    setUser(u);
  }, []);

  // When the server says the user record no longer exists, clear the session.
  const handleApiError = useCallback(async (status: number, message?: string) => {
    if (status === 404 && message?.toLowerCase().includes("user")) {
      await clearSession();
    }
  }, [clearSession]);

  const attemptRefresh = useCallback(async (rt: string) => {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: rt }),
    });
    if (!res.ok) throw new Error("refresh failed");
    const json = (await res.json()) as {
      data: { accessToken: string; refreshToken: string };
    };
    const { accessToken: newAt, refreshToken: newRt } = json.data;
    await Promise.all([
      SecureStore.setItemAsync(KEY_ACCESS, newAt),
      SecureStore.setItemAsync(KEY_REFRESH, newRt),
    ]);
    const payload = parseJwt(newAt);
    if (!payload) throw new Error("bad token");
    setAccessToken(newAt);
    setRefreshToken(newRt);
    setUser({ id: String(payload["sub"]), phone: "", role: String(payload["role"]) });
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, accessToken, refreshToken, isLoading, setSession, clearSession, handleApiError }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
