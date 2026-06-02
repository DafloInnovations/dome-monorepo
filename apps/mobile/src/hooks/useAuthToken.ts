import * as SecureStore from "expo-secure-store";
import { useAuth, type AuthUser } from "../context/AuthContext";

// Must match the keys used in AuthContext
const KEY_ACCESS = "dome_access_token";
const KEY_REFRESH = "dome_refresh_token";

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";

const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]!));
    return (payload as { exp: number }).exp * 1000 < Date.now();
  } catch {
    return true;
  }
};

/**
 * Returns getValidToken() and checkResponse().
 *
 * getValidToken() — reads SecureStore directly so every call sees the freshest
 * token even after a mid-session rotation (avoids stale React state closures).
 *
 * checkResponse() — call after any authenticated fetch. Triggers automatic
 * logout when the server returns 404 "user not found" (e.g. account deleted).
 * The RootNav guard in _layout.tsx handles the redirect to /(auth)/phone.
 */
export function useAuthToken() {
  const { setSession, clearSession, handleApiError } = useAuth();

  async function getValidToken(): Promise<string> {
    const accessToken = await SecureStore.getItemAsync(KEY_ACCESS);
    if (!accessToken) throw new Error("Not authenticated");

    if (!isTokenExpired(accessToken)) return accessToken;

    const refreshToken = await SecureStore.getItemAsync(KEY_REFRESH);
    if (!refreshToken) {
      await clearSession();
      throw new Error("Session expired. Please sign in again.");
    }

    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      // Parse body before clearing — a 404 here means the user was deleted.
      let message: string | undefined;
      try {
        const body = (await res.json()) as { message?: string };
        message = body.message;
      } catch {}
      await handleApiError(res.status, message);
      await clearSession();
      throw new Error("Session expired. Please sign in again.");
    }

    const json = (await res.json()) as {
      data: { accessToken: string; refreshToken: string };
    };
    const { accessToken: newAt, refreshToken: newRt } = json.data;

    await Promise.all([
      SecureStore.setItemAsync(KEY_ACCESS, newAt),
      SecureStore.setItemAsync(KEY_REFRESH, newRt),
    ]);

    let user: AuthUser;
    try {
      const payload = JSON.parse(atob(newAt.split(".")[1]!)) as {
        sub: string;
        role: string;
      };
      user = { id: String(payload.sub), phone: "", role: String(payload.role) };
    } catch {
      await clearSession();
      throw new Error("Invalid token received from server");
    }

    await setSession(newAt, newRt, user);
    return newAt;
  }

  /**
   * Pass any authenticated API response here.
   * Automatically logs the user out on 404 "user not found".
   */
  async function checkResponse(res: Response): Promise<void> {
    if (res.ok) return;
    try {
      const body = (await res.clone().json()) as { message?: string };
      await handleApiError(res.status, body.message);
    } catch {}
  }

  return { getValidToken, checkResponse };
}
