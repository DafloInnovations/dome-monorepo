"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { getToken } from "../../lib/api";

interface ApplicationStatus {
  status: "PENDING" | "APPROVED" | "REJECTED" | "NONE";
  businessName?: string;
  submittedAt?: string;
  rejectionReason?: string;
}

export default function PendingPage() {
  const router = useRouter();
  const [status, setStatus] = useState<ApplicationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function checkStatus() {
    if (!getToken()) { router.replace("/"); return; }
    try {
      const res = await apiFetch<{ data: ApplicationStatus }>("/vendor/application-status");
      const data = res.data;
      setStatus(data);

      if (data.status === "APPROVED") {
        router.replace("/dashboard");
      } else if (data.status === "REJECTED") {
        router.replace("/rejected");
      } else if (data.status === "NONE") {
        router.replace("/onboarding");
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    checkStatus();
    // Auto-refresh every 60 seconds
    const interval = setInterval(checkStatus, 60_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submittedDate = status?.submittedAt
    ? new Date(status.submittedAt).toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" })
    : null;

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-white tracking-tight">DOME</h1>
          <p className="text-muted text-sm mt-1">Vendor Application</p>
        </div>

        <div className="bg-surface border border-border rounded-dome p-8 mb-6">
          {isLoading ? (
            <div className="py-4">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-muted text-sm">Checking status…</p>
            </div>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-yellow-900/30 border border-yellow-700 flex items-center justify-center mx-auto mb-5">
                <span className="text-3xl">⏳</span>
              </div>

              <h2 className="text-xl font-bold text-white mb-2">Application Under Review</h2>
              <p className="text-sm text-muted leading-relaxed mb-5">
                We&apos;re reviewing your application for{" "}
                <span className="text-white">{status?.businessName ?? "your business"}</span>.
                We&apos;ll notify you via SMS once approved.
              </p>

              <div className="bg-surface-2 border border-border rounded-dome p-4 text-left mb-5">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted">Status</span>
                  <span className="text-yellow-400 font-semibold">Pending Review</span>
                </div>
                {submittedDate && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Submitted</span>
                    <span className="text-white">{submittedDate}</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted mb-5">
                Typical review time: <span className="text-white">24–48 hours</span>
              </p>

              <div className="flex items-center justify-center gap-2 text-xs text-muted">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                Auto-checking every 60 seconds
              </div>
            </>
          )}
        </div>

        <button
          onClick={() => router.push("/onboarding")}
          className="text-sm text-muted hover:text-white transition-colors"
        >
          Edit application
        </button>
      </div>
    </div>
  );
}
