"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Header from "../../../../components/layout/Header";
import StatusBadge from "../../../../components/ui/StatusBadge";
import Modal from "../../../../components/ui/Modal";
import Toast from "../../../../components/ui/Toast";
import { apiFetch, type AdminUser, type AdminBooking } from "../../../../lib/api";

const ROLES = ["PLAYER", "VENDOR", "ADMIN"] as const;
type Role = (typeof ROLES)[number];

interface ToastState { message: string; type: "success" | "error" }

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const router = useRouter();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<ToastState | null>(null);

  // Role change
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role>("PLAYER");
  const [roleLoading, setRoleLoading] = useState(false);

  useEffect(() => {
    apiFetch<{ data: AdminUser }>(`/admin/users/${id}`)
      .then((r) => {
        setUser(r.data);
        setSelectedRole((r.data.role as Role) ?? "PLAYER");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Not found"))
      .finally(() => setIsLoading(false));
  }, [id]);

  async function handleRoleChange() {
    if (!user || selectedRole === user.role) return;
    setRoleLoading(true);
    try {
      await apiFetch(`/admin/users/${id}/role`, {
        method: "PUT",
        body: JSON.stringify({ role: selectedRole }),
      });
      setUser((u) => u ? { ...u, role: selectedRole } : u);
      setToast({ message: `Role updated to ${selectedRole}`, type: "success" });
      setShowRoleModal(false);
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : "Failed to update role", type: "error" });
    } finally {
      setRoleLoading(false);
    }
  }

  if (isLoading) return (
    <>
      <Header title="User" />
      <main className="flex-1 p-6 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 bg-surface border border-border rounded-dome animate-pulse" />
        ))}
      </main>
    </>
  );

  if (error || !user) return (
    <>
      <Header title="User" />
      <main className="flex-1 p-6">
        <button onClick={() => router.back()} className="text-xs text-muted hover:text-white mb-4 block">← Back</button>
        <p className="text-red-400">{error || "User not found"}</p>
      </main>
    </>
  );

  const name = `${user.firstName} ${user.lastName}`.trim() || user.phone;

  return (
    <>
      <Header title={name} />
      <main className="flex-1 p-6 space-y-6 overflow-auto">
        <button onClick={() => router.back()} className="text-xs text-muted hover:text-white">← Back to Users</button>

        {/* Profile card */}
        <div className="bg-surface border border-border rounded-dome p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
            <div>
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h2 className="text-xl font-bold text-white">{name}</h2>
                <StatusBadge status={user.role} />
              </div>
              <p className="text-sm text-muted">{user.phone}</p>
            </div>

            <button
              onClick={() => { setSelectedRole(user.role as Role); setShowRoleModal(true); }}
              className="border border-border text-muted hover:text-white hover:border-primary/50 text-xs font-medium px-3 py-1.5 rounded-dome transition-colors"
            >
              Change Role
            </button>
          </div>

          <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-sm">
            {[
              ["Province", user.province],
              ["Credits", `C$${user.creditBalanceCAD.toFixed(2)}`],
              ["Total Bookings", String(user._count?.bookings ?? 0)],
              ["Joined", new Date(user.createdAt).toLocaleDateString("en-CA")],
            ].map(([label, val]) => (
              <div key={label}>
                <dt className="text-xs text-muted mb-0.5">{label}</dt>
                <dd className="text-white font-semibold">{val}</dd>
              </div>
            ))}
          </dl>

          {user.vendor && (
            <div className="mt-5 pt-4 border-t border-border flex items-center justify-between">
              <div>
                <p className="text-xs text-muted mb-0.5">Vendor Account</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-white font-medium">{user.vendor.businessName}</p>
                  <StatusBadge status={user.vendor.status} />
                </div>
              </div>
              <Link
                href={`/dashboard/vendors/${user.vendor.id}`}
                className="text-xs text-primary hover:underline"
              >
                View vendor →
              </Link>
            </div>
          )}
        </div>

        {/* Booking history */}
        <div className="bg-surface border border-border rounded-dome p-5">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wide mb-4">
            Bookings
            {user._count?.bookings != null && (
              <span className="ml-1.5 font-normal normal-case text-white">
                {user.bookings && user.bookings.length < user._count.bookings
                  ? `— showing ${user.bookings.length} of ${user._count.bookings}`
                  : `(${user._count.bookings})`}
              </span>
            )}
          </h3>
          {!user.bookings || user.bookings.length === 0 ? (
            <p className="text-muted text-sm text-center py-6">No bookings yet</p>
          ) : (
            <div className="divide-y divide-border">
              {user.bookings.map((b: AdminBooking) => (
                <div key={b.id} className="flex items-center justify-between py-3 gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{b.facility.name}</p>
                    <p className="text-xs text-muted">
                      {b.slot.date} · {b.slot.startTime}–{b.slot.endTime}
                      {b.facility.address?.city ? ` · ${b.facility.address.city}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm text-white font-medium">C${b.totalCAD.toFixed(2)}</span>
                    <StatusBadge status={b.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Credits history */}
        <div className="bg-surface border border-border rounded-dome p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wide">
              Dome Credits History
            </h3>
            <span className="text-sm font-bold text-primary">
              Balance: C${user.creditBalanceCAD.toFixed(2)}
            </span>
          </div>
          {!user.domeCredits || user.domeCredits.length === 0 ? (
            <p className="text-muted text-sm text-center py-6">No credit history</p>
          ) : (
            <div className="divide-y divide-border">
              {user.domeCredits.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-muted">{c.reason || "Credit adjustment"}</span>
                  <div className="flex items-center gap-3">
                    <span className={`font-semibold ${c.amountCAD >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {c.amountCAD >= 0 ? "+" : ""}C${c.amountCAD.toFixed(2)}
                    </span>
                    <span className="text-xs text-muted w-20 text-right">
                      {new Date(c.createdAt).toLocaleDateString("en-CA")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Role change modal */}
      <Modal
        open={showRoleModal}
        title="Change User Role"
        confirmLabel={`Set Role: ${selectedRole}`}
        cancelLabel="Cancel"
        destructive={selectedRole === "ADMIN"}
        isLoading={roleLoading}
        onConfirm={handleRoleChange}
        onCancel={() => setShowRoleModal(false)}
      >
        <p className="text-sm text-muted mb-4">
          Changing role for <strong className="text-white">{name}</strong>.
          Current role: <span className="font-semibold text-white">{user?.role}</span>
        </p>
        <div className="flex gap-2">
          {ROLES.map((r) => (
            <button
              key={r}
              onClick={() => setSelectedRole(r)}
              className={`flex-1 py-2.5 text-sm font-bold rounded-dome border transition-colors ${
                selectedRole === r
                  ? r === "ADMIN"
                    ? "bg-red-700 border-red-600 text-white"
                    : "bg-primary border-primary text-white"
                  : "border-border text-muted hover:text-white hover:border-primary/50"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        {selectedRole === "ADMIN" && (
          <p className="text-xs text-red-400 mt-3">
            ⚠️ Admin role grants full platform access. Only grant this to trusted team members.
          </p>
        )}
      </Modal>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </>
  );
}
