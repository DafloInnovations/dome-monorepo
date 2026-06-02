"use client";

import { clearToken, getStoredUser, getToken, type VendorUser } from "./api";

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function getCurrentUser(): VendorUser | null {
  return getStoredUser();
}

export function requireVendorAuth(): boolean {
  const token = getToken();
  if (!token) return false;
  const user = getStoredUser();
  if (!user) return false;
  return user.role === "VENDOR";
}

export function logout() {
  clearToken();
  window.location.href = "/";
}
