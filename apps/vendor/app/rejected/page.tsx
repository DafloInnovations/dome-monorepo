"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { getToken } from "../../lib/api";

interface ApplicationStatus {
  status: "PENDING" | "APPROVED" | "REJECTED" | "NONE";
  businessName?: string;
  rejectionReason?: string;
  submittedAt?: string;
}

export default function RejectedPage() {
  const router  = useRouter();
  const [status, setStatus] = useState<ApplicationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { router.replace("/"); return; }
    apiFetch<{ data: ApplicationStatus }>("/vendor/application-status")
      .then((r) => {
        const data = r.data;
        setStatus(data);
        if (data.status === "APPROVED") router.replace("/dashboard");
        if (data.status === "PENDING")  router.replace("/pending");
        if (data.status === "NONE")     router.replace("/onboarding");
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [router]);

  function handleReapply() {
    // Pre-fill the onboarding form with existing data and redirect
    router.push("/onboarding");
  }

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
              <p className="text-muted text-sm">Loading…</p>
            </div>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-red-900/30 border border-red-700 flex items-center justify-center mx-auto mb-5">
                <span className="text-3xl">❌</span>
              </div>

              <h2 className="text-xl font-bold text-white mb-2">Application Not Approved</h2>
              <p className="text-sm text-muted leading-relaxed mb-5">
                Unfortunately, your application for{" "}
                <span className="text-white">{status?.businessName ?? "your business"}</span>{" "}
                was not approved at this time.
              </p>

              {status?.rejectionReason && (
                <div className="bg-red-900/20 border border-red-800/50 rounded-dome p-4 text-left mb-5">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">Reason</p>
                  <p className="text-sm text-red-300">{status.rejectionReason}</p>
                </div>
              )}

              <div className="space-y-3">
                <button
                  onClick={handleReapply}
                  className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 rounded-dome transition-colors text-sm"
                >
                  Reapply
                </button>
                <a
                  href="mailto:support@dome.ca"
                  className="block w-full py-3 text-sm font-medium text-muted hover:text-white bg-surface-2 border border-border rounded-dome transition-colors"
                >
                  Contact Support
                </a>
              </div>
            </>
          )}
        </div>

        <p className="text-xs text-muted">
          Questions? Email us at{" "}
          <a href="mailto:support@dome.ca" className="text-primary hover:underline">support@dome.ca</a>
        </p>
      </div>
    </div>
  );
}
