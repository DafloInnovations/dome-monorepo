"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../../components/layout/Sidebar";
import { clearToken, isAdmin } from "../../lib/auth";
import { doRefreshAccessToken } from "../../lib/api";

const INACTIVITY_TIMEOUT_MS = 4 * 60 * 60 * 1000;
const WARNING_BEFORE_MS     = 5 * 60 * 1000;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [showWarning, setShowWarning] = useState(false);

  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimerRef   = useRef<() => void>(() => {});

  // ─── Auth guard ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAdmin()) router.replace("/");
  }, [router]);

  // ─── Inactivity timer ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAdmin()) return;

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
  }, [router]);

  async function stayLoggedIn() {
    const newToken = await doRefreshAccessToken();
    if (newToken) {
      setShowWarning(false);
      resetTimerRef.current();
    }
  }

  return (
    <>
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
        <div className="flex flex-col flex-1 min-w-0">{children}</div>
      </div>
    </>
  );
}
