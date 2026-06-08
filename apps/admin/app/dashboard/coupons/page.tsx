"use client";

import { useCallback, useEffect, useState } from "react";
import Header from "../../../components/layout/Header";
import { apiFetch } from "../../../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type CouponType = "PERCENTAGE" | "FIXED" | "FREE";

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  type: CouponType;
  value: number;
  vendorId: string | null;
  facilityId: string | null;
  sport: string | null;
  minBookingCAD: number | null;
  maxDiscountCAD: number | null;
  usageLimit: number | null;
  usageLimitPerUser: number | null;
  usageCount: number;
  usedCount: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  vendor: { businessName: string } | null;
  facility: { name: string } | null;
}

const EMPTY_FORM = {
  code: "",
  description: "",
  type: "PERCENTAGE" as CouponType,
  value: 20,
  vendorId: "",
  facilityId: "",
  sport: "",
  minBookingCAD: "",
  maxDiscountCAD: "",
  usageLimit: "",
  usageLimitPerUser: "1",
  validFrom: new Date().toISOString().split("T")[0]!,
  validUntil: new Date(Date.now() + 30 * 24 * 3_600_000).toISOString().split("T")[0]!,
};

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rand = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `DOME-${rand}`;
}

function couponValueLabel(c: Coupon) {
  if (c.type === "FREE") return "100% Free";
  if (c.type === "PERCENTAGE") return `${c.value}%${c.maxDiscountCAD ? ` (max C$${c.maxDiscountCAD})` : ""}`;
  return `C$${c.value}`;
}

function statusBadge(c: Coupon) {
  const now = new Date();
  if (!c.isActive) return { label: "Inactive", cls: "bg-gray-800 text-gray-400" };
  if (new Date(c.validUntil) < now) return { label: "Expired", cls: "bg-red-900/40 text-red-400" };
  if (c.usageLimit !== null && c.usedCount >= c.usageLimit) return { label: "Used up", cls: "bg-yellow-900/40 text-yellow-400" };
  return { label: "Active", cls: "bg-green-900/40 text-green-400" };
}

const inputCls = "w-full bg-black border border-border rounded-dome px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-primary";

// ─── Create/Edit Modal ────────────────────────────────────────────────────────

function CouponModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: Coupon;
  onSave: (c: Coupon) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState(initial
    ? {
        code: initial.code,
        description: initial.description ?? "",
        type: initial.type,
        value: String(initial.value),
        vendorId: initial.vendorId ?? "",
        facilityId: initial.facilityId ?? "",
        sport: initial.sport ?? "",
        minBookingCAD: initial.minBookingCAD != null ? String(initial.minBookingCAD) : "",
        maxDiscountCAD: initial.maxDiscountCAD != null ? String(initial.maxDiscountCAD) : "",
        usageLimit: initial.usageLimit != null ? String(initial.usageLimit) : "",
        usageLimitPerUser: initial.usageLimitPerUser != null ? String(initial.usageLimitPerUser) : "1",
        validFrom: initial.validFrom.split("T")[0]!,
        validUntil: initial.validUntil.split("T")[0]!,
      }
    : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = {
        code: form.code || undefined,
        description: form.description || undefined,
        type: form.type,
        value: Number(form.value),
        vendorId: form.vendorId || null,
        facilityId: form.facilityId || null,
        sport: form.sport || null,
        minBookingCAD: form.minBookingCAD ? Number(form.minBookingCAD) : null,
        maxDiscountCAD: form.maxDiscountCAD ? Number(form.maxDiscountCAD) : null,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
        usageLimitPerUser: form.usageLimitPerUser ? Number(form.usageLimitPerUser) : 1,
        validFrom: new Date(form.validFrom).toISOString(),
        validUntil: new Date(form.validUntil + "T23:59:59").toISOString(),
      };
      const res = initial
        ? await apiFetch<{ data: Coupon }>(`/admin/coupons/${initial.id}`, { method: "PUT", body: JSON.stringify(body) })
        : await apiFetch<{ data: Coupon }>("/admin/coupons", { method: "POST", body: JSON.stringify(body) });
      onSave(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-surface border border-border rounded-dome w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="text-white font-bold text-lg">{initial ? "Edit Coupon" : "Create Coupon"}</h2>
          <button onClick={onClose} className="text-muted hover:text-white text-xl">×</button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          {/* Code */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-muted mb-1">Code *</label>
              <input className={inputCls} placeholder="DOME20" value={form.code}
                onChange={(e) => set("code", e.target.value.toUpperCase())} />
            </div>
            <div className="self-end">
              <button type="button"
                onClick={() => set("code", generateCode())}
                className="px-3 py-2 text-xs font-semibold bg-surface border border-border hover:border-primary text-white rounded-dome transition-colors">
                Generate
              </button>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-muted mb-1">Description</label>
            <input className={inputCls} placeholder="20% off your first booking"
              value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>

          {/* Type + Value */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-muted mb-1">Type *</label>
              <select className={inputCls} value={form.type}
                onChange={(e) => set("type", e.target.value)}>
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED">Fixed Amount (C$)</option>
                <option value="FREE">Free (100% off)</option>
              </select>
            </div>
            {form.type !== "FREE" && (
              <div>
                <label className="block text-xs text-muted mb-1">
                  Value {form.type === "PERCENTAGE" ? "(%)" : "(C$)"} *
                </label>
                <input type="number" min="0.01" step="0.01" className={inputCls}
                  value={form.value} onChange={(e) => set("value", e.target.value)} required />
              </div>
            )}
          </div>

          {form.type === "PERCENTAGE" && (
            <div>
              <label className="block text-xs text-muted mb-1">Max discount cap (C$, optional)</label>
              <input type="number" min="0" step="1" className={inputCls} placeholder="e.g. 50"
                value={form.maxDiscountCAD} onChange={(e) => set("maxDiscountCAD", e.target.value)} />
            </div>
          )}

          {/* Scope */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Vendor ID (blank = platform-wide)</label>
              <input className={inputCls} placeholder="vendor_..." value={form.vendorId}
                onChange={(e) => set("vendorId", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Facility ID (blank = all)</label>
              <input className={inputCls} placeholder="facility_..." value={form.facilityId}
                onChange={(e) => set("facilityId", e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Sport (blank = all)</label>
            <select className={inputCls} value={form.sport} onChange={(e) => set("sport", e.target.value)}>
              <option value="">All sports</option>
              {["BADMINTON","PICKLEBALL","TENNIS","BASKETBALL","SOCCER","VOLLEYBALL","HOCKEY","SQUASH","BASEBALL","CRICKET"].map((s) => (
                <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
              ))}
            </select>
          </div>

          {/* Limits */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Min booking (C$)</label>
              <input type="number" min="0" step="1" className={inputCls} placeholder="e.g. 25"
                value={form.minBookingCAD} onChange={(e) => set("minBookingCAD", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Total uses (blank=∞)</label>
              <input type="number" min="1" step="1" className={inputCls} placeholder="∞"
                value={form.usageLimit} onChange={(e) => set("usageLimit", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Per user limit</label>
              <input type="number" min="1" step="1" className={inputCls}
                value={form.usageLimitPerUser} onChange={(e) => set("usageLimitPerUser", e.target.value)} />
            </div>
          </div>

          {/* Validity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Valid from *</label>
              <input type="date" className={`${inputCls} [color-scheme:dark]`} value={form.validFrom}
                onChange={(e) => set("validFrom", e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Valid until *</label>
              <input type="date" className={`${inputCls} [color-scheme:dark]`} value={form.validUntil}
                onChange={(e) => set("validUntil", e.target.value)} required />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-muted hover:text-white border border-border rounded-dome transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-5 py-2 text-sm font-semibold bg-primary hover:bg-primary-hover disabled:opacity-50 text-white rounded-dome transition-colors">
              {saving ? "Saving…" : (initial ? "Save Changes" : "Create Coupon")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [filterActive, setFilterActive] = useState<"" | "true" | "false">("");
  const [filterType, setFilterType] = useState<"" | CouponType>("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Coupon | undefined>();

  const load = useCallback(() => {
    setIsLoading(true);
    const qs = new URLSearchParams();
    if (filterActive) qs.set("isActive", filterActive);
    if (filterType) qs.set("type", filterType);
    apiFetch<{ data: Coupon[]; total: number }>(`/admin/coupons?${qs}`)
      .then((r) => { setCoupons(r.data); setTotal(r.total); })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setIsLoading(false));
  }, [filterActive, filterType]);

  useEffect(() => { load(); }, [load]);

  async function handleDeactivate(id: string) {
    if (!confirm("Deactivate this coupon?")) return;
    await apiFetch(`/admin/coupons/${id}`, { method: "DELETE" });
    load();
  }

  function handleSaved(c: Coupon) {
    setCoupons((prev) => {
      const idx = prev.findIndex((x) => x.id === c.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = c; return next; }
      return [c, ...prev];
    });
    setShowModal(false);
    setEditing(undefined);
  }

  const selectCls = "bg-black border border-border text-white text-sm rounded-dome px-3 py-1.5 focus:outline-none focus:border-primary";

  // Stats
  const activeCoupons = coupons.filter((c) => c.isActive && new Date(c.validUntil) >= new Date());
  const totalRedemptions = coupons.reduce((s, c) => s + c.usedCount, 0);

  return (
    <>
      <Header title="Coupon Management" />
      <main className="flex-1 p-6 space-y-6 overflow-auto">

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Active coupons", value: activeCoupons.length },
            { label: "Total coupons", value: total },
            { label: "Total redemptions", value: totalRedemptions },
            { label: "Platform-wide", value: coupons.filter((c) => !c.vendorId).length },
          ].map((s) => (
            <div key={s.label} className="bg-surface border border-border rounded-dome p-4">
              <p className="text-xs text-muted uppercase tracking-wide mb-1">{s.label}</p>
              <p className="text-2xl font-bold text-white">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          <select className={selectCls} value={filterActive}
            onChange={(e) => setFilterActive(e.target.value as "" | "true" | "false")}>
            <option value="">All status</option>
            <option value="true">Active only</option>
            <option value="false">Inactive only</option>
          </select>
          <select className={selectCls} value={filterType}
            onChange={(e) => setFilterType(e.target.value as "" | CouponType)}>
            <option value="">All types</option>
            <option value="PERCENTAGE">Percentage</option>
            <option value="FIXED">Fixed</option>
            <option value="FREE">Free</option>
          </select>
          <div className="ml-auto">
            <button
              onClick={() => { setEditing(undefined); setShowModal(true); }}
              className="bg-primary hover:bg-primary-hover text-white text-sm font-semibold px-4 py-2 rounded-dome transition-colors">
              + Create Coupon
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-dome px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-surface border border-border rounded-dome overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Code", "Type / Value", "Scope", "Usage", "Valid Until", "Status", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted">Loading…</td>
                </tr>
              ) : coupons.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <p className="text-2xl mb-2">🎟️</p>
                    <p className="text-white font-semibold">No coupons yet</p>
                    <p className="text-muted text-xs mt-1">Create your first coupon above</p>
                  </td>
                </tr>
              ) : (
                coupons.map((c) => {
                  const badge = statusBadge(c);
                  return (
                    <tr key={c.id} className="border-b border-border last:border-0 hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-mono font-bold text-white">{c.code}</p>
                        {c.description && <p className="text-xs text-muted mt-0.5 truncate max-w-[160px]">{c.description}</p>}
                      </td>
                      <td className="px-4 py-3 text-white">{couponValueLabel(c)}</td>
                      <td className="px-4 py-3 text-muted text-xs">
                        {c.vendor ? c.vendor.businessName : "Platform-wide"}
                        {c.facility && <span className="block text-[10px]">{c.facility.name}</span>}
                        {c.sport && <span className="block text-[10px]">{c.sport}</span>}
                      </td>
                      <td className="px-4 py-3 text-white">
                        {c.usedCount}/{c.usageLimit ?? "∞"}
                      </td>
                      <td className="px-4 py-3 text-muted text-xs">
                        {new Date(c.validUntil).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setEditing(c); setShowModal(true); }}
                            className="text-xs text-primary hover:underline">Edit</button>
                          {c.isActive && (
                            <button
                              onClick={() => handleDeactivate(c.id)}
                              className="text-xs text-muted hover:text-red-400 transition-colors">Deactivate</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </main>

      {showModal && (
        <CouponModal
          initial={editing}
          onSave={handleSaved}
          onClose={() => { setShowModal(false); setEditing(undefined); }}
        />
      )}
    </>
  );
}
