"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../../components/layout/Sidebar";
import { getToken } from "../../lib/api";
import { apiFetch } from "../../lib/api";

interface AppStatus {
  status: "PENDING" | "APPROVED" | "REJECTED" | "NONE";
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router  = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) { router.replace("/"); return; }

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
      .catch(() => {
        // If the check fails (network error), allow the dashboard to render
        // so the user isn't locked out by a transient API issue
        setReady(true);
      });
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-black">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {children}
      </div>
    </div>
  );
}
