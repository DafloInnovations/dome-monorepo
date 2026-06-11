"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Header from "../../../components/layout/Header";
import StatusBadge from "../../../components/ui/StatusBadge";
import Toast from "../../../components/ui/Toast";
import { apiFetch, type AdminVendor } from "../../../lib/api";

const STATUS_OPTS = ["PENDING", "APPROVED", "REJECTED", "ALL"] as const;
type StatusOpt = (typeof STATUS_OPTS)[number];
const PAGE_SIZE = 20;

interface ToastState { message: string; type: "success" | "error" }

function VendorsList() {
  const searchParams = useSearchParams();
  const initialStatus = (searchParams?.get("status") as StatusOpt) ?? "PENDING";

  const [vendors, setVendors] = useState<AdminVendor[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusOpt>(initialStatus);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(() => {
    setIsLoading(true);
    setLoadError(null);
    const qs = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (status !== "ALL") qs.set("status", status);
    apiFetch<{ data: AdminVendor[]; total: number }>(`/admin/vendors?${qs}`)
      .then((r) => { setVendors(r.data); setTotal(r.total); })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Failed to load vendors"))
      .finally(() => setIsLoading(false));
  }, [page, status]);

  useEffect(() => { load(); }, [load]);

  async function quickApprove(id: string, businessName: string) {
    setActionId(id);
    try {
      await apiFetch(`/admin/vendors/${id}/approve`, { method: "PUT", body: JSON.stringify({}) });
      setToast({ message: `${businessName} approved!`, type: "success" });
      setVendors((v) => v.filter((x) => x.id !== id));
      setTotal((t) => t - 1);
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : "Failed to approve", type: "error" });
    } finally {
      setActionId(null);
    }
  }

  const counts = {
    PENDING: status === "PENDING" ? total : null,
    APPROVED: status === "APPROVED" ? total : null,
    REJECTED: status === "REJECTED" ? total : null,
    ALL: status === "ALL" ? total : null,
  };

  return (
    <main className="flex-1 p-6 space-y-4 overflow-auto">
      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap border-b border-border pb-4">
        {STATUS_OPTS.map((s) => (
          <button
            key={s}
            onClick={() => { setStatus(s); setPage(1); }}
            className={`px-4 py-2 text-sm font-semibold rounded-dome border transition-colors ${
              status === s
                ? s === "PENDING"
                  ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-400"
                  : "bg-primary border-primary text-white"
                : "border-border text-muted hover:text-white hover:border-primary/50"
            }`}
          >
            {s}
            {counts[s] !== null && (
              <span className="ml-1.5 text-xs opacity-70">({counts[s]})</span>
            )}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted self-center">{total} vendor{total !== 1 ? "s" : ""}</span>
      </div>

      {/* Vendor cards */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 bg-surface border border-border rounded-dome animate-pulse" />
          ))}
        </div>
      ) : loadError ? (
        <div className="text-center py-16">
          <p className="text-red-400 text-sm mb-2">{loadError}</p>
          <button onClick={load} className="text-xs text-muted hover:text-white underline">Retry</button>
        </div>
      ) : vendors.length === 0 ? (
        <div className="text-center py-16 text-muted">
          <p className="text-4xl mb-3">🏟️</p>
          <p className="text-sm">No {status !== "ALL" ? status.toLowerCase() : ""} vendors</p>
        </div>
      ) : (
        <div className="space-y-3">
          {vendors.map((v) => (
            <div key={v.id} className="bg-surface border border-border rounded-dome p-5 flex items-start gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Link href={`/dashboard/vendors/${v.id}`} className="text-base font-bold text-white hover:text-primary truncate">
                    {v.businessName}
                  </Link>
                  <StatusBadge status={v.status} />
                </div>
                <p className="text-xs text-muted mb-1">
                  {[v.city, v.province].filter(Boolean).join(", ")} · {v.sports.join(", ") || "—"}
                </p>
                <p className="text-xs text-muted">
                  {v.user.firstName} {v.user.lastName} · {v.user.phone}
                </p>
                {v.submittedAt && (
                  <p className="text-xs text-muted mt-1">
                    Applied {new Date(v.submittedAt).toLocaleDateString("en-CA")}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {v.status === "PENDING" && (
                  <button
                    onClick={() => quickApprove(v.id, v.businessName)}
                    disabled={actionId === v.id}
                    className="bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded-dome transition-colors"
                  >
                    {actionId === v.id ? "…" : "✓ Approve"}
                  </button>
                )}
                <Link
                  href={`/dashboard/vendors/${v.id}`}
                  className="border border-border text-muted hover:text-white hover:border-primary/50 text-xs font-medium px-3 py-1.5 rounded-dome transition-colors"
                >
                  View →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-xs text-muted pt-2">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 border border-border rounded-dome disabled:opacity-40 hover:text-white hover:border-primary/50 transition-colors">
            ← Prev
          </button>
          <span>Page {page} of {Math.ceil(total / PAGE_SIZE)}</span>
          <button disabled={page >= Math.ceil(total / PAGE_SIZE)} onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 border border-border rounded-dome disabled:opacity-40 hover:text-white hover:border-primary/50 transition-colors">
            Next →
          </button>
        </div>
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </main>
  );
}

export default function VendorsPage() {
  return (
    <>
      <Header title="Vendors" />
      <Suspense
        fallback={
          <main className="flex-1 p-6">
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-24 bg-surface border border-border rounded-dome animate-pulse" />
              ))}
            </div>
          </main>
        }
      >
        <VendorsList />
      </Suspense>
    </>
  );
}
