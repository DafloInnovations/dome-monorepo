"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Header from "../../../../../components/layout/Header";
import { api, apiFetch, type Slot } from "../../../../../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BulkForm {
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  priceCAD: number;
}

interface BlockForm {
  startDate: string;
  endDate: string;
  reason: string;
}

interface CtxMenu {
  slotId: string;
  status: string;
  x: number;
  y: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  AVAILABLE: "bg-green-900/40 text-green-400 border-green-800",
  BOOKED:    "bg-red-900/40 text-red-400 border-red-800",
  HELD:      "bg-yellow-900/40 text-yellow-400 border-yellow-800",
  BLOCKED:   "bg-gray-800 text-gray-400 border-gray-700",
  OPEN_GAME: "bg-blue-900/40 text-blue-400 border-blue-800",
};

const CAN_ACT = (status: string) => status !== "BOOKED" && status !== "HELD";

// ─── DateInput ────────────────────────────────────────────────────────────────

function DateInput({
  label, value, onChange, required = true,
}: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <label className="block text-xs text-muted mb-1">{label}</label>
      <div className="relative">
        <input
          ref={ref} type="date" required={required} value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-black border border-border rounded-dome pl-3 pr-11 py-2 text-white text-sm focus:outline-none focus:border-primary [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:hidden"
        />
        <button type="button" onClick={() => { ref.current?.showPicker?.(); ref.current?.focus(); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded text-muted hover:text-white hover:bg-white/5 transition-colors">
          📅
        </button>
      </div>
    </div>
  );
}

// ─── ConfirmModal ─────────────────────────────────────────────────────────────

function ConfirmModal({
  message, confirmLabel = "Delete", isLoading, onConfirm, onCancel,
}: {
  message: string; confirmLabel?: string; isLoading?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-surface border border-border rounded-dome p-6 max-w-sm w-full mx-4 space-y-4">
        <p className="text-white text-sm">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} disabled={isLoading}
            className="px-4 py-2 text-sm text-muted hover:text-white bg-black border border-border rounded-dome transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isLoading}
            className="px-4 py-2 text-sm font-semibold text-white bg-red-700 hover:bg-red-800 disabled:opacity-50 rounded-dome transition-colors">
            {isLoading ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── BulkPriceModal ───────────────────────────────────────────────────────────

function BulkPriceModal({
  count, isLoading, onConfirm, onCancel,
}: {
  count: number; isLoading?: boolean; onConfirm: (price: string) => void; onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-surface border border-border rounded-dome p-6 max-w-sm w-full mx-4 space-y-4">
        <p className="text-white text-sm font-semibold">Change price for {count} slot{count !== 1 ? "s" : ""}</p>
        <div>
          <label className="block text-xs text-muted mb-1">New price (C$)</label>
          <input
            type="number" min="0.01" step="1" value={value} autoFocus
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && value) onConfirm(value); }}
            className="w-full bg-black border border-border rounded-dome px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
          />
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} disabled={isLoading}
            className="px-4 py-2 text-sm text-muted hover:text-white bg-black border border-border rounded-dome transition-colors">
            Cancel
          </button>
          <button onClick={() => onConfirm(value)} disabled={isLoading || !value}
            className="px-4 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary-hover disabled:opacity-50 rounded-dome transition-colors">
            {isLoading ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SlotsPage() {
  const { id: courtId } = useParams<{ id: string }>();

  // Slots
  const [slots, setSlots] = useState<Slot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Inline price editor
  const [priceEdit, setPriceEdit] = useState<{ slotId: string; value: string } | null>(null);

  // Context menu (right-click)
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);

  // Confirm modals
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null); // single slotId
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkBlockConfirm, setBulkBlockConfirm] = useState(false);
  const [bulkPriceModal, setBulkPriceModal] = useState(false);

  // Action loading
  const [actionLoading, setActionLoading] = useState(false);

  // Generate form
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [generateConflict, setGenerateConflict] = useState<{ existed: number; pending: BulkForm } | null>(null);
  const today = new Date().toISOString().split("T")[0]!;
  const [form, setForm] = useState<BulkForm>({
    startDate: today,
    endDate: new Date(Date.now() + 7 * 24 * 3_600_000).toISOString().split("T")[0]!,
    startTime: "08:00", endTime: "22:00",
    slotDurationMinutes: 60, priceCAD: 28,
  });

  // Block dates form
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [blockResult, setBlockResult] = useState<string | null>(null);
  const [blockForm, setBlockForm] = useState<BlockForm>({ startDate: "", endDate: "", reason: "" });

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadSlots = useCallback(() => {
    setIsLoading(true);
    api.vendor.courtSlots(courtId!, today)
      .then((r) => setSlots(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setIsLoading(false));
  }, [courtId, today]);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  // Close context menu on outside click
  useEffect(() => {
    if (!ctxMenu) return;
    const handler = () => setCtxMenu(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [ctxMenu]);

  // ── Selection helpers ─────────────────────────────────────────────────────

  function toggleSelect(slotId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(slotId)) next.delete(slotId);
      else next.add(slotId);
      return next;
    });
  }

  function toggleSelectAll() {
    const actionable = slots.filter((s) => CAN_ACT(s.status)).map((s) => s.id);
    if (selectedIds.size === actionable.length && actionable.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(actionable));
    }
  }

  // ── Slot actions ──────────────────────────────────────────────────────────

  async function deleteSlot(slotId: string) {
    setActionLoading(true);
    try {
      await api.vendor.deleteSlot(slotId);
      setSlots((prev) => prev.filter((s) => s.id !== slotId));
      setDeleteConfirm(null);
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(slotId); return n; });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function bulkDelete() {
    setActionLoading(true);
    const ids = Array.from(selectedIds);
    try {
      await api.vendor.bulkDeleteSlots(ids);
      setSlots((prev) => prev.filter((s) => !selectedIds.has(s.id)));
      setSelectedIds(new Set());
      setBulkDeleteConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk delete failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function blockSlot(slotId: string) {
    setActionLoading(true);
    try {
      const res = await api.vendor.blockSlot(slotId);
      setSlots((prev) => prev.map((s) => (s.id === slotId ? res.data : s)));
      setCtxMenu(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Block failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function unblockSlot(slotId: string) {
    setActionLoading(true);
    try {
      const res = await api.vendor.unblockSlot(slotId);
      setSlots((prev) => prev.map((s) => (s.id === slotId ? res.data : s)));
      setCtxMenu(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unblock failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function savePrice(slotId: string, value: string) {
    const priceCAD = parseFloat(value);
    if (isNaN(priceCAD) || priceCAD <= 0) return;
    setActionLoading(true);
    try {
      const res = await api.vendor.updateSlot(slotId, { priceCAD });
      setSlots((prev) => prev.map((s) => (s.id === slotId ? res.data : s)));
      setPriceEdit(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Price update failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function bulkBlock() {
    setActionLoading(true);
    const ids = Array.from(selectedIds).filter((id) => {
      const s = slots.find((sl) => sl.id === id);
      return s?.status === "AVAILABLE";
    });
    try {
      const updated: Slot[] = [];
      for (const slotId of ids) {
        const res = await api.vendor.blockSlot(slotId);
        updated.push(res.data);
      }
      const map = new Map(updated.map((s) => [s.id, s]));
      setSlots((prev) => prev.map((s) => map.get(s.id) ?? s));
      setSelectedIds(new Set());
      setBulkBlockConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Block failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function bulkChangePrice(price: string) {
    const priceCAD = parseFloat(price);
    if (isNaN(priceCAD) || priceCAD <= 0) return;
    setActionLoading(true);
    const ids = Array.from(selectedIds).filter((id) => {
      const s = slots.find((sl) => sl.id === id);
      return s && CAN_ACT(s.status);
    });
    try {
      const updated: Slot[] = [];
      for (const slotId of ids) {
        const res = await api.vendor.updateSlot(slotId, { priceCAD });
        updated.push(res.data);
      }
      const map = new Map(updated.map((s) => [s.id, s]));
      setSlots((prev) => prev.map((s) => map.get(s.id) ?? s));
      setSelectedIds(new Set());
      setBulkPriceModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Price update failed");
    } finally {
      setActionLoading(false);
    }
  }

  // ── Generate slots ─────────────────────────────────────────────────────────

  async function runGenerate(payload: BulkForm, strategy: "skip" | "replace" = "skip") {
    setIsSaving(true);
    setError("");
    try {
      const res = await apiFetch<{ data: { count: number; existed: number } }>(
        `/vendor/courts/${courtId}/slots/bulk`,
        { method: "POST", body: JSON.stringify({ ...payload, conflictStrategy: strategy }) }
      );
      setShowBulkForm(false);
      setGenerateConflict(null);
      loadSlots();
      if (strategy === "skip" && res.data.existed > 0) {
        setGenerateConflict({ existed: res.data.existed, pending: payload });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate slots");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleBulkGenerate(e: React.FormEvent) {
    e.preventDefault();
    await runGenerate(form, "skip");
  }

  async function handleBlockDates(e: React.FormEvent) {
    e.preventDefault();
    if (!courtId) return;
    setIsBlocking(true);
    setError("");
    setBlockResult(null);
    try {
      const res = await api.vendor.blockSlots({
        courtId,
        startDate: blockForm.startDate,
        endDate: blockForm.endDate,
        reason: blockForm.reason || undefined,
      });
      setBlockResult(`Blocked ${res.data.blocked} slot(s).`);
      loadSlots();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to block slots");
    } finally {
      setIsBlocking(false);
    }
  }

  // ── Derived state ──────────────────────────────────────────────────────────

  const byDate = slots.reduce<Record<string, Slot[]>>((acc, slot) => {
    const day = slot.date.split("T")[0]!;
    if (!acc[day]) acc[day] = [];
    acc[day]!.push(slot);
    return acc;
  }, {});
  const dateKeys = Object.keys(byDate).sort();

  const actionableSlots = slots.filter((s) => CAN_ACT(s.status));
  const allSelected = actionableSlots.length > 0 && selectedIds.size === actionableSlots.length;
  const blockableSelected = Array.from(selectedIds).some(
    (id) => slots.find((s) => s.id === id)?.status === "AVAILABLE"
  );

  const inputCls = "w-full bg-black border border-border rounded-dome px-3 py-2 text-white text-sm focus:outline-none focus:border-primary";

  return (
    <>
      <Header title="Slot Management" />
      <main className="flex-1 p-6 space-y-4 overflow-auto">

        {/* ── Top toolbar ───────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <Link
            href={`/dashboard/courts/${courtId}/pricing`}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold border border-primary/50 text-primary hover:bg-primary hover:text-white rounded-dome transition-colors"
          >
            ⚡ Manage Pricing
          </Link>

          {/* Status legend */}
          <div className="flex gap-2 text-xs flex-wrap">
            {Object.entries(STATUS_STYLE).map(([status, cls]) => (
              <span key={status} className={`px-2 py-0.5 rounded border ${cls}`}>
                {status === "BLOCKED" ? "🔒 " : ""}
                {status.charAt(0) + status.slice(1).toLowerCase().replace("_", " ")}
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => { setShowBlockForm((v) => !v); setShowBulkForm(false); setBlockResult(null); }}
              className="bg-surface border border-border text-muted hover:text-white text-sm font-semibold px-4 py-2 rounded-dome transition-colors"
            >
              {showBlockForm ? "Cancel" : "🚫 Block Dates"}
            </button>
            <button
              onClick={() => { setShowBulkForm((v) => !v); setShowBlockForm(false); setGenerateConflict(null); }}
              className="bg-primary hover:bg-primary-hover text-white text-sm font-semibold px-4 py-2 rounded-dome transition-colors"
            >
              {showBulkForm ? "Cancel" : "⚡ Generate Slots"}
            </button>
          </div>
        </div>

        {/* ── Generate form ──────────────────────────────────────────── */}
        {showBulkForm && (
          <div className="bg-surface border border-border rounded-dome p-6">
            <h2 className="font-bold text-white mb-4">Generate Slots</h2>
            <form onSubmit={handleBulkGenerate} className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <DateInput label="Start Date" value={form.startDate}
                onChange={(v) => setForm((f) => ({ ...f, startDate: v }))} />
              <DateInput label="End Date" value={form.endDate}
                onChange={(v) => setForm((f) => ({ ...f, endDate: v }))} />
              {(["startTime", "endTime"] as const).map((key) => (
                <div key={key}>
                  <label className="block text-xs text-muted mb-1">{key === "startTime" ? "Start Time" : "End Time"}</label>
                  <input type="time" value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className={inputCls} required />
                </div>
              ))}
              <div>
                <label className="block text-xs text-muted mb-1">Duration</label>
                <select value={form.slotDurationMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, slotDurationMinutes: Number(e.target.value) }))}
                  className={inputCls}>
                  <option value={30}>30 min</option>
                  <option value={60}>60 min</option>
                  <option value={90}>90 min</option>
                  <option value={120}>120 min</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Price per slot (C$)</label>
                <input type="number" min={1} step={0.01} value={form.priceCAD}
                  onChange={(e) => setForm((f) => ({ ...f, priceCAD: Number(e.target.value) }))}
                  className={inputCls} required />
              </div>
              {error && <p className="col-span-full text-red-400 text-sm">{error}</p>}
              <div className="col-span-full">
                <button type="submit" disabled={isSaving}
                  className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-dome transition-colors">
                  {isSaving ? "Generating…" : "Generate"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Conflict banner — shown after generate if existing slots were skipped */}
        {generateConflict && (
          <div className="bg-yellow-900/30 border border-yellow-700 rounded-dome px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-yellow-300 text-sm">
              {generateConflict.existed} slot{generateConflict.existed !== 1 ? "s" : ""} already existed in this period (skipped).
            </p>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => runGenerate(generateConflict.pending, "replace")}
                disabled={isSaving}
                className="text-xs font-semibold px-3 py-1.5 bg-yellow-700 hover:bg-yellow-600 text-white rounded-dome transition-colors disabled:opacity-50"
              >
                {isSaving ? "Replacing…" : "Replace available slots"}
              </button>
              <button onClick={() => setGenerateConflict(null)}
                className="text-xs text-yellow-400 hover:text-white transition-colors px-2">
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* ── Block dates form ───────────────────────────────────────── */}
        {showBlockForm && (
          <div className="bg-surface border border-border rounded-dome p-6">
            <h2 className="font-bold text-white mb-4">Block Dates (Maintenance)</h2>
            <form onSubmit={handleBlockDates} className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
              <DateInput label="Start Date" value={blockForm.startDate}
                onChange={(v) => setBlockForm((f) => ({ ...f, startDate: v }))} />
              <DateInput label="End Date" value={blockForm.endDate}
                onChange={(v) => setBlockForm((f) => ({ ...f, endDate: v }))} />
              <div>
                <label className="block text-xs text-muted mb-1">Reason (optional)</label>
                <input type="text" placeholder="e.g. Maintenance" value={blockForm.reason}
                  onChange={(e) => setBlockForm((f) => ({ ...f, reason: e.target.value }))}
                  className={inputCls} />
              </div>
              <button type="submit" disabled={isBlocking}
                className="bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-dome transition-colors">
                {isBlocking ? "Blocking…" : "Block Slots"}
              </button>
              {blockResult && <p className="col-span-full text-green-400 text-sm">{blockResult}</p>}
            </form>
          </div>
        )}

        {/* ── Bulk actions toolbar ───────────────────────────────────── */}
        {selectedIds.size > 0 && (
          <div className="sticky top-0 z-20 bg-surface border border-primary/40 rounded-dome px-4 py-3 flex items-center gap-4 flex-wrap shadow-lg">
            <span className="text-primary text-sm font-semibold">
              ☑ {selectedIds.size} slot{selectedIds.size !== 1 ? "s" : ""} selected
            </span>
            <div className="flex gap-2 ml-auto flex-wrap">
              {blockableSelected && (
                <button onClick={() => setBulkBlockConfirm(true)}
                  className="text-xs font-semibold px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-dome transition-colors">
                  🔒 Block
                </button>
              )}
              <button onClick={() => setBulkPriceModal(true)}
                className="text-xs font-semibold px-3 py-1.5 bg-surface border border-border hover:border-primary text-white rounded-dome transition-colors">
                C$ Change Price
              </button>
              <button onClick={() => setBulkDeleteConfirm(true)}
                className="text-xs font-semibold px-3 py-1.5 bg-red-900/50 hover:bg-red-800 text-red-300 rounded-dome transition-colors">
                🗑 Delete ({selectedIds.size})
              </button>
              <button onClick={() => setSelectedIds(new Set())}
                className="text-xs text-muted hover:text-white transition-colors px-2">
                Clear
              </button>
            </div>
          </div>
        )}

        {/* ── Slot summary + select-all ──────────────────────────────── */}
        {!isLoading && slots.length > 0 && (
          <div className="flex items-center gap-4 text-sm flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={allSelected} onChange={toggleSelectAll}
                className="w-3.5 h-3.5 accent-primary" />
              <span className="text-muted text-xs">Select all</span>
            </label>
            <span className="text-green-400">{slots.filter((s) => s.status === "AVAILABLE").length} available</span>
            <span className="text-red-400">{slots.filter((s) => s.status === "BOOKED").length} booked</span>
            <span className="text-gray-400">{slots.filter((s) => s.status === "BLOCKED").length} blocked</span>
            {slots.filter((s) => s.status === "HELD").length > 0 && (
              <span className="text-yellow-400">{slots.filter((s) => s.status === "HELD").length} held</span>
            )}
          </div>
        )}

        {/* ── Error banner ───────────────────────────────────────────── */}
        {error && !showBulkForm && (
          <div className="bg-red-900/30 border border-red-700 rounded-dome px-4 py-3 flex items-center justify-between">
            <p className="text-red-400 text-sm">{error}</p>
            <button onClick={() => setError("")} className="text-red-400 hover:text-white ml-4 text-lg leading-none">×</button>
          </div>
        )}

        {/* ── Calendar grid ──────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-surface border border-border rounded-dome animate-pulse" />
            ))}
          </div>
        ) : dateKeys.length === 0 ? (
          <div className="text-center py-20 text-muted">
            <p className="text-4xl mb-4">📅</p>
            <p className="font-semibold text-white">No slots in the next 30 days</p>
            <p className="text-sm mt-1">Use "Generate Slots" to create bookable time blocks.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {dateKeys.map((dateKey) => {
              const daySlots = byDate[dateKey]!;
              const d = new Date(dateKey + "T00:00:00");
              const label = d.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });

              return (
                <div key={dateKey}>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">{label}</p>
                  <div className="flex flex-wrap gap-2">
                    {daySlots.map((slot) => {
                      const canAct = CAN_ACT(slot.status);
                      const isSelected = selectedIds.has(slot.id);
                      const isEditing = priceEdit?.slotId === slot.id;

                      function handleSlotClick() {
                        if (!canAct || isEditing) return;
                        if (selectedIds.size > 0) {
                          toggleSelect(slot.id);
                        } else {
                          setPriceEdit({ slotId: slot.id, value: slot.priceCAD.toFixed(2) });
                        }
                      }

                      return (
                        <div
                          key={slot.id}
                          className={[
                            "relative group flex items-center gap-1.5 pl-2 py-1.5 rounded border text-xs font-medium transition-colors",
                            isEditing ? "pr-2" : "pr-7",
                            STATUS_STYLE[slot.status] ?? "bg-surface border-border text-white",
                            isSelected ? "ring-1 ring-primary ring-offset-1 ring-offset-black" : "",
                            canAct ? "cursor-pointer" : "cursor-default opacity-80",
                          ].join(" ")}
                          onClick={handleSlotClick}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            if (canAct) setCtxMenu({ slotId: slot.id, status: slot.status, x: e.clientX, y: e.clientY });
                          }}
                        >
                          {/* Checkbox */}
                          {canAct && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(slot.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-3 h-3 accent-primary shrink-0"
                            />
                          )}

                          {/* Time + price or inline price editor */}
                          {isEditing ? (
                            <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <span className="text-muted">C$</span>
                              <input
                                type="number" min="0.01" step="1" autoFocus
                                value={priceEdit!.value}
                                onChange={(e) => setPriceEdit({ slotId: slot.id, value: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") savePrice(slot.id, priceEdit!.value);
                                  if (e.key === "Escape") setPriceEdit(null);
                                }}
                                className="w-14 bg-black border border-primary rounded px-1 py-0 text-white text-xs focus:outline-none"
                              />
                              <button onClick={() => savePrice(slot.id, priceEdit!.value)}
                                disabled={actionLoading}
                                className="text-green-400 hover:text-green-300 leading-none font-bold">✓</button>
                              <button onClick={() => setPriceEdit(null)}
                                className="text-muted hover:text-white leading-none">✕</button>
                            </span>
                          ) : (
                            <span>
                              {slot.startTime}–{slot.endTime}
                              <span className="ml-1 opacity-60">C${slot.priceCAD.toFixed(0)}</span>
                              {slot.status === "BLOCKED" && <span className="ml-1">🔒</span>}
                            </span>
                          )}

                          {/* Hover delete button */}
                          {canAct && !isEditing && (
                            <button
                              className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 w-5 h-5 flex items-center justify-center"
                              onClick={(e) => { e.stopPropagation(); setDeleteConfirm(slot.id); }}
                              title="Delete slot"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Context menu ────────────────────────────────────────────── */}
      {ctxMenu && (
        <div
          className="fixed z-50 bg-surface border border-border rounded-dome py-1 shadow-xl min-w-[160px]"
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {ctxMenu.status === "AVAILABLE" && (
            <button
              className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
              onClick={() => blockSlot(ctxMenu.slotId)}
            >
              🔒 Block this slot
            </button>
          )}
          {ctxMenu.status === "BLOCKED" && (
            <button
              className="w-full text-left px-4 py-2 text-sm text-green-400 hover:bg-white/5 transition-colors"
              onClick={() => unblockSlot(ctxMenu.slotId)}
            >
              ✓ Unblock slot
            </button>
          )}
          <button
            className="w-full text-left px-4 py-2 text-sm text-muted hover:bg-white/5 hover:text-white transition-colors"
            onClick={() => { setPriceEdit({ slotId: ctxMenu.slotId, value: (slots.find(s => s.id === ctxMenu.slotId)?.priceCAD ?? 0).toFixed(2) }); setCtxMenu(null); }}
          >
            C$ Edit price
          </button>
          <div className="border-t border-border my-1" />
          <button
            className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-white/5 transition-colors"
            onClick={() => { setDeleteConfirm(ctxMenu.slotId); setCtxMenu(null); }}
          >
            🗑 Delete slot
          </button>
        </div>
      )}

      {/* ── Single delete confirm ────────────────────────────────────── */}
      {deleteConfirm && (
        <ConfirmModal
          message="Delete this slot? This cannot be undone."
          confirmLabel="Delete slot"
          isLoading={actionLoading}
          onConfirm={() => deleteSlot(deleteConfirm)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {/* ── Bulk delete confirm ──────────────────────────────────────── */}
      {bulkDeleteConfirm && (
        <ConfirmModal
          message={`Delete ${selectedIds.size} slot${selectedIds.size !== 1 ? "s" : ""}? Booked slots will be skipped.`}
          confirmLabel={`Delete ${selectedIds.size} slots`}
          isLoading={actionLoading}
          onConfirm={bulkDelete}
          onCancel={() => setBulkDeleteConfirm(false)}
        />
      )}

      {/* ── Bulk block confirm ───────────────────────────────────────── */}
      {bulkBlockConfirm && (
        <ConfirmModal
          message={`Block all selected available slots (${selectedIds.size})?`}
          confirmLabel="Block slots"
          isLoading={actionLoading}
          onConfirm={bulkBlock}
          onCancel={() => setBulkBlockConfirm(false)}
        />
      )}

      {/* ── Bulk price modal ─────────────────────────────────────────── */}
      {bulkPriceModal && (
        <BulkPriceModal
          count={selectedIds.size}
          isLoading={actionLoading}
          onConfirm={bulkChangePrice}
          onCancel={() => setBulkPriceModal(false)}
        />
      )}
    </>
  );
}
