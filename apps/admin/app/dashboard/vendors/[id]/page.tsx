"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "../../../../components/layout/Header";
import StatusBadge from "../../../../components/ui/StatusBadge";
import Modal from "../../../../components/ui/Modal";
import Toast from "../../../../components/ui/Toast";
import { apiFetch, type AdminVendor } from "../../../../lib/api";

interface ToastState { message: string; type: "success" | "error" }

export default function VendorDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const router = useRouter();
  const [vendor, setVendor] = useState<AdminVendor | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    apiFetch<{ data: AdminVendor }>(`/admin/vendors/${id}`)
      .then((r) => setVendor(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : "Not found"))
      .finally(() => setIsLoading(false));
  }, [id]);

  async function handleApprove() {
    setActionLoading(true);
    try {
      await apiFetch(`/admin/vendors/${id}/approve`, { method: "PUT", body: JSON.stringify({}) });
      setVendor((v) => v ? { ...v, status: "APPROVED" } : v);
      setToast({ message: "Vendor approved! They will be notified.", type: "success" });
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : "Failed to approve", type: "error" });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) return;
    setActionLoading(true);
    try {
      await apiFetch(`/admin/vendors/${id}/reject`, {
        method: "PUT",
        body: JSON.stringify({ reason: rejectReason }),
      });
      setVendor((v) => v ? { ...v, status: "REJECTED", rejectionReason: rejectReason } : v);
      setToast({ message: "Application rejected. Vendor has been notified.", type: "success" });
      setShowRejectModal(false);
      setRejectReason("");
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : "Failed to reject", type: "error" });
    } finally {
      setActionLoading(false);
    }
  }

  if (isLoading) return (
    <>
      <Header title="Vendor" />
      <main className="flex-1 p-6 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 bg-surface border border-border rounded-dome animate-pulse" />
        ))}
      </main>
    </>
  );

  if (error || !vendor) return (
    <>
      <Header title="Vendor" />
      <main className="flex-1 p-6">
        <button onClick={() => router.back()} className="text-xs text-muted hover:text-white mb-4 block">← Back</button>
        <p className="text-red-400">{error || "Vendor not found"}</p>
      </main>
    </>
  );

  const isPending = vendor.status === "PENDING";

  return (
    <>
      <Header title={vendor.businessName} />
      <main className="flex-1 p-6 space-y-6 overflow-auto">
        <button onClick={() => router.back()} className="text-xs text-muted hover:text-white">← Back to Vendors</button>

        {/* Header card */}
        <div className="bg-surface border border-border rounded-dome p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h2 className="text-2xl font-black text-white">{vendor.businessName}</h2>
                <StatusBadge status={vendor.status} />
              </div>
              <p className="text-sm text-muted">{[vendor.streetAddress, vendor.city, vendor.province, vendor.postalCode].filter(Boolean).join(", ")}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted">
                {vendor.businessEmail && <span>✉ {vendor.businessEmail}</span>}
                {vendor.businessPhone && <span>📞 {vendor.businessPhone}</span>}
                {vendor.website && <a href={vendor.website} target="_blank" rel="noreferrer" className="hover:text-primary">🌐 {vendor.website}</a>}
              </div>
              {vendor.sports.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {vendor.sports.map((s) => (
                    <span key={s} className="bg-surface-2 border border-border px-2 py-0.5 rounded text-xs text-muted capitalize">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {isPending && (
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-bold px-5 py-2.5 rounded-dome transition-colors"
                >
                  ✅ Approve Vendor
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={actionLoading}
                  className="border border-red-700 text-red-400 hover:bg-red-900/30 disabled:opacity-50 text-sm font-bold px-5 py-2.5 rounded-dome transition-colors"
                >
                  ❌ Reject
                </button>
              </div>
            )}
          </div>

          {vendor.rejectionReason && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted uppercase tracking-wide mb-1">Rejection Reason</p>
              <p className="text-sm text-red-400">{vendor.rejectionReason}</p>
            </div>
          )}
        </div>

        {/* Metadata grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Owner info */}
          <div className="bg-surface border border-border rounded-dome p-5">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Owner</h3>
            <dl className="space-y-2 text-sm">
              {[
                ["Name", `${vendor.user.firstName} ${vendor.user.lastName}`.trim() || "—"],
                ["Phone", vendor.user.phone],
                ["Member Since", vendor.user.createdAt ? new Date(vendor.user.createdAt).toLocaleDateString("en-CA") : "—"],
                ["Province", vendor.user.province ?? vendor.province],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-muted">{label}</dt>
                  <dd className="text-white font-medium">{val || "—"}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Application info */}
          <div className="bg-surface border border-border rounded-dome p-5">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Application</h3>
            <dl className="space-y-2 text-sm">
              {[
                ["Status", vendor.status],
                ["Applied", vendor.submittedAt ? new Date(vendor.submittedAt).toLocaleDateString("en-CA") : "—"],
                ["Approved", vendor.approvedAt ? new Date(vendor.approvedAt).toLocaleDateString("en-CA") : "—"],
                ["Facilities", String(vendor._count?.facilities ?? 0)],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-muted">{label}</dt>
                  <dd className="text-white font-medium">{val}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* Description */}
        {vendor.description && (
          <div className="bg-surface border border-border rounded-dome p-5">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Business Description</h3>
            <p className="text-sm text-white/90 whitespace-pre-wrap leading-relaxed">{vendor.description}</p>
          </div>
        )}

        {/* Facilities */}
        {vendor.facilities && vendor.facilities.length > 0 && (
          <div className="bg-surface border border-border rounded-dome p-5">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">
              Facilities ({vendor.facilities.length})
            </h3>
            <div className="divide-y divide-border">
              {vendor.facilities.map((f) => (
                <div key={f.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-white">{f.name}</p>
                    <p className="text-xs text-muted capitalize">{f.sport.toLowerCase()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted">{f._count.bookings} bookings</span>
                    <StatusBadge status={f.isActive ? "ACTIVE" : "SUSPENDED"} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Rejection modal */}
      <Modal
        open={showRejectModal}
        title="Reject Vendor Application"
        confirmLabel="Reject Application"
        cancelLabel="Cancel"
        destructive
        isLoading={actionLoading}
        onConfirm={handleReject}
        onCancel={() => { setShowRejectModal(false); setRejectReason(""); }}
      >
        <p className="text-sm text-muted mb-3">
          Please provide a reason for rejecting <strong className="text-white">{vendor?.businessName}</strong>.
          This will be sent to the vendor.
        </p>
        <textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="e.g. Incomplete business information, invalid address, duplicate account…"
          rows={4}
          minLength={10}
          className="w-full bg-black border border-border rounded-dome px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-red-500 resize-none"
        />
        {rejectReason.length > 0 && rejectReason.length < 10 && (
          <p className="text-xs text-red-400 mt-1">Reason must be at least 10 characters.</p>
        )}
      </Modal>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </>
  );
}
