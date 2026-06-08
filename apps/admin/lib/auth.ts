const TOKEN_KEY         = "dome_admin_token";
const REFRESH_TOKEN_KEY = "dome_admin_refresh_token";
const USER_KEY          = "dome_admin_user";

export interface AdminUser {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  role: string;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(t: string) { localStorage.setItem(TOKEN_KEY, t); }

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(t: string) { localStorage.setItem(REFRESH_TOKEN_KEY, t); }

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isTokenExpiringSoon(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]!)) as { exp?: number };
    const expiresIn = (payload.exp ?? 0) - Date.now() / 1000;
    return expiresIn < 30 * 60;
  } catch {
    return true;
  }
}

export function getStoredUser(): AdminUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AdminUser) : null;
  } catch { return null; }
}

export function setStoredUser(u: AdminUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(u));
}

export function isAdmin(): boolean {
  const user = getStoredUser();
  return !!getToken() && user?.role === "ADMIN";
}
