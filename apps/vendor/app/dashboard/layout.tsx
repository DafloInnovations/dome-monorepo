"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../../components/layout/Sidebar";
import { VendorProfileProvider } from "../../components/layout/VendorProfileProvider";
import { apiFetch, clearToken, doRefreshAccessToken, getToken } from "../../lib/api";

interface AppStatus {
  status: "PENDING" | "APPROVED" | "REJECTED" | "NONE";
}

const INACTIVITY_TIMEOUT_MS = 4 * 60 * 60 * 1000;   // 4 hours
const WARNING_BEFORE_MS     = 5 * 60 * 1000;          // warn 5 min before logout

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router  = useRouter();
  const [ready, setReady] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimerRef   = useRef<() => void>(() => {});

  // ─── Auth check on mount ──────────────────────────────────────────────────
  useEffect(() => {
    const token = getToken();
    if (!token) { router.replace("/"); return; }

    apiFetch<{ data: AppStatus }>("/vendor/application-status")
      .then((r) => {
        const s = r.data.status;
        if (s === "APPROVED") {
          setReady(true);
        } else if (s === "PENDING") {
          router.replace("/pending");
        } else if (s === "REJECTED") {
          router.replace("/rejected");
        } else {
          router.replace("/onboarding");
        }
      })
      .catch((err: unknown) => {
        const isAuthError =
          err instanceof Error && err.message.toLowerCase().includes("session");
        if (!isAuthError) setReady(true);
      });
  }, [router]);

  // ─── Inactivity timer (only after auth passes) ────────────────────────────
  useEffect(() => {
    if (!ready) return;

    function resetTimer() {
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (logoutTimerRef.current)  clearTimeout(logoutTimerRef.current);
      setShowWarning(false);

      warningTimerRef.current = setTimeout(() => {
        setShowWarning(true);
        logoutTimerRef.current = setTimeout(() => {
          clearToken();
          router.push("/?expired=true");
        }, WARNING_BEFORE_MS);
      }, INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_MS);
    }

    resetTimerRef.current = resetTimer;

    window.addEventListener("mousedown", resetTimer);
    window.addEventListener("keydown",   resetTimer);
    window.addEventListener("scroll",    resetTimer, { passive: true });
    window.addEventListener("touchstart",resetTimer, { passive: true });

    resetTimer();

    return () => {
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (logoutTimerRef.current)  clearTimeout(logoutTimerRef.current);
      window.removeEventListener("mousedown", resetTimer);
      window.removeEventListener("keydown",   resetTimer);
      window.removeEventListener("scroll",    resetTimer);
      window.removeEventListener("touchstart",resetTimer);
    };
  }, [ready, router]);

  async function stayLoggedIn() {
    const newToken = await doRefreshAccessToken();
    if (newToken) {
      setShowWarning(false);
      resetTimerRef.current();
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <VendorProfileProvider>
      {showWarning && (
        <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between gap-4 bg-amber-500 text-white px-6 py-3 shadow-lg">
          <span className="text-sm font-semibold">
            ⚠️ Your session expires in 5 minutes due to inactivity
          </span>
          <button
            onClick={stayLoggedIn}
            className="shrink-0 bg-white text-amber-600 font-bold text-sm px-4 py-1.5 rounded-lg hover:bg-amber-50 transition-colors"
          >
            Stay Logged In
          </button>
        </div>
      )}
      <div className={`flex min-h-screen bg-black ${showWarning ? "pt-[52px]" : ""}`}>
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {children}
        </div>
      </div>
    </VendorProfileProvider>
  );
}
