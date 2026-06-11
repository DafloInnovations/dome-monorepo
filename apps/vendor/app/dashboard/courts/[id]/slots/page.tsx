"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
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
  sport?: string;
  weekdays?: number[];
}

interface QuickForm {
  startDate: string;
  endDate: string;
  slotDurationMinutes: number;
  sport?: string;
  wdStartTime: string;
  wdEndTime: string;
  wdPrice: number;
  weStartTime: string;
  weEndTime: string;
  wePrice: number;
}

type GenTab = "quick" | "weekday" | "weekend" | "custom";

interface CourtInfo {
  isShared: boolean;
  sports: string[];
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

const SPORT_EMOJI: Record<string, string> = {
  BADMINTON: "🏸", PICKLEBALL: "🏓", TENNIS: "🎾", SQUASH: "🎾",
  SOCCER: "⚽", BASKETBALL: "🏀", VOLLEYBALL: "🏐", HOCKEY: "🏒",
  BASEBALL: "⚾", CRICKET: "🏏",
};

const DAY_LABELS: { day: number; label: string }[] = [
  { day: 1, label: "Mon" }, { day: 2, label: "Tue" }, { day: 3, label: "Wed" },
  { day: 4, label: "Thu" }, { day: 5, label: "Fri" }, { day: 6, label: "Sat" },
  { day: 0, label: "Sun" },
];

const DURATIONS = [30, 60, 90, 120];

const CAN_ACT = (status: string) => status !== "BOOKED" && status !== "HELD";

// ─── Utils ────────────────────────────────────────────────────────────────────

function calcPreview(
  startDate: string, endDate: string,
  startTime: string, endTime: string,
  durationMinutes: number, priceCAD: number,
  weekdays?: number[]
): { days: number; slotsPerDay: number; total: number; revenue: number } | null {
  if (!startDate || !endDate || !startTime || !endTime || durationMinutes <= 0) return null;
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const windowMins = (eh! * 60 + em!) - (sh! * 60 + sm!);
  if (windowMins <= 0) return null;
  const slotsPerDay = Math.floor(windowMins / durationMinutes);
  if (slotsPerDay <= 0) return null;
  let days = 0;
  const cur = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  while (cur <= end) {
    const d = cur.getDay();
    if (!weekdays || weekdays.includes(d)) days++;
    cur.setDate(cur.getDate() + 1);
  }
  return { days, slotsPerDay, total: days * slotsPerDay, revenue: Math.round(days * slotsPerDay * priceCAD * 100) / 100 };
}

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

  // Court info (for shared court sport tabs)
  const [courtInfo, setCourtInfo] = useState<CourtInfo | null>(null);
  const [activeSportTab, setActiveSportTab] = useState<string | null>(null);

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
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkBlockConfirm, setBulkBlockConfirm] = useState(false);
  const [bulkPriceModal, setBulkPriceModal] = useState(false);

  // Action loading
  const [actionLoading, setActionLoading] = useState(false);

  // Generate form
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [genTab, setGenTab] = useState<GenTab>("quick");
  const [isSaving, setIsSaving] = useState(false);
  const [generateConflict, setGenerateConflict] = useState<{ existed: number; pending: BulkForm } | null>(null);

  const today = new Date().toISOString().split("T")[0]!;
  const defaultEnd = new Date(Date.now() + 30 * 24 * 3_600_000).toISOString().split("T")[0]!;

  const [quickForm, setQuickForm] = useState<QuickForm>({
    startDate: today, endDate: defaultEnd,
    slotDurationMinutes: 60,
    wdStartTime: "06:00", wdEndTime: "23:00", wdPrice: 25,
    weStartTime: "08:00", weEndTime: "22:00", wePrice: 35,
  });

  const [wdForm, setWdForm] = useState<BulkForm>({
    startDate: today, endDate: defaultEnd,
    startTime: "06:00", endTime: "23:00",
    slotDurationMinutes: 60, priceCAD: 25,
    weekdays: [1, 2, 3, 4, 5],
  });

  const [weForm, setWeForm] = useState<BulkForm>({
    startDate: today, endDate: defaultEnd,
    startTime: "08:00", endTime: "22:00",
    slotDurationMinutes: 60, priceCAD: 35,
    weekdays: [0, 6],
  });

  const [customForm, setCustomForm] = useState<BulkForm>({
    startDate: today, endDate: defaultEnd,
    startTime: "08:00", endTime: "22:00",
    slotDurationMinutes: 60, priceCAD: 30,
  });
  const [customDays, setCustomDays] = useState<number[]>([1, 2, 3, 4, 5]);

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

  // Load court info directly from the API — authoritative source for isShared + sports
  useEffect(() => {
    if (!courtId) return;
    apiFetch<{ data: { isShared: boolean; sports: string[]; primarySport: string | null } }>(
      `/vendor/courts/${courtId}`
    ).then((r) => {
      const { isShared, sports, primarySport } = r.data;
      if (isShared && sports.length > 0) {
        setCourtInfo({ isShared: true, sports });
        setActiveSportTab((prev) => prev ?? sports[0]!);
      } else {
        const sole = primarySport ?? sports[0] ?? null;
        setCourtInfo({ isShared: false, sports: sole ? [sole] : [] });
      }
    }).catch(() => null);
  }, [courtId]);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  useEffect(() => {
    if (!ctxMenu) return;
    const handler = () => setCtxMenu(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [ctxMenu]);

  // ── Previews (client-side) ────────────────────────────────────────────────

  const quickPreview = useMemo(() => {
    if (!showBulkForm || genTab !== "quick") return null;
    const wd = calcPreview(quickForm.startDate, quickForm.endDate, quickForm.wdStartTime, quickForm.wdEndTime, quickForm.slotDurationMinutes, quickForm.wdPrice, [1, 2, 3, 4, 5]);
    const we = calcPreview(quickForm.startDate, quickForm.endDate, quickForm.weStartTime, quickForm.weEndTime, quickForm.slotDurationMinutes, quickForm.wePrice, [0, 6]);
    return { wd, we };
  }, [showBulkForm, genTab, quickForm]);

  const singlePreview = useMemo(() => {
    if (!showBulkForm || genTab === "quick") return null;
    const f = genTab === "weekday" ? wdForm : genTab === "weekend" ? weForm : customForm;
    const weekdays = genTab === "weekday" ? [1, 2, 3, 4, 5] : genTab === "weekend" ? [0, 6] : customDays;
    return calcPreview(f.startDate, f.endDate, f.startTime, f.endTime, f.slotDurationMinutes, f.priceCAD, weekdays);
  }, [showBulkForm, genTab, wdForm, weForm, customForm, customDays]);

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
      const res = await apiFetch<{ data: { created: number; skipped: number; total: number; existed: number } }>(
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

  async function runQuickSetup() {
    setIsSaving(true);
    setError("");
    try {
      await apiFetch<{
        data: {
          weekdaySlots: { created: number; skipped: number };
          weekendSlots: { created: number; skipped: number };
          total: { created: number; skipped: number };
        };
      }>(`/vendor/courts/${courtId}/slots/bulk-schedule`, {
        method: "POST",
        body: JSON.stringify({
          startDate: quickForm.startDate,
          endDate: quickForm.endDate,
          slotDurationMinutes: quickForm.slotDurationMinutes,
          sport: quickForm.sport || undefined,
          weekday: { startTime: quickForm.wdStartTime, endTime: quickForm.wdEndTime, priceCAD: quickForm.wdPrice },
          weekend: { startTime: quickForm.weStartTime, endTime: quickForm.weEndTime, priceCAD: quickForm.wePrice },
        }),
      });
      setShowBulkForm(false);
      loadSlots();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate slots");
    } finally {
      setIsSaving(false);
    }
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

  const visibleSlots = courtInfo?.isShared && activeSportTab
    ? slots.filter((s) => (s as Slot & { sport?: string }).sport === activeSportTab)
    : slots;

  const byDate = visibleSlots.reduce<Record<string, Slot[]>>((acc, slot) => {
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

  // ── Shared sub-form helpers ────────────────────────────────────────────────

  function SportSelect({ value, onChange }: { value: string | undefined; onChange: (v: string | undefined) => void }) {
    if (!courtInfo?.isShared || courtInfo.sports.length === 0) return null;
    return (
      <div>
        <label className="block text-xs text-muted mb-1">Sport</label>
        <select value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)} className={inputCls}>
          <option value="">All Sports</option>
          {courtInfo.sports.map((s) => (
            <option key={s} value={s}>{SPORT_EMOJI[s] ?? ""} {s.charAt(0) + s.slice(1).toLowerCase()}</option>
          ))}
        </select>
      </div>
    );
  }

  function DurationSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    return (
      <div>
        <label className="block text-xs text-muted mb-1">Duration</label>
        <div className="flex gap-1">
          {DURATIONS.map((d) => (
            <button key={d} type="button" onClick={() => onChange(d)}
              className={[
                "flex-1 py-2 text-xs font-semibold rounded-dome border transition-colors",
                value === d ? "bg-primary border-primary text-white" : "border-border text-muted hover:text-white",
              ].join(" ")}>
              {d}m
            </button>
          ))}
        </div>
      </div>
    );
  }

  function PreviewBox({ preview }: { preview: { days: number; slotsPerDay: number; total: number; revenue: number } | null }) {
    if (!preview) return null;
    return (
      <div className="bg-black/40 border border-border rounded-xl p-4 font-mono text-xs">
        <p className="text-muted">
          {preview.days} days × {preview.slotsPerDay} slots/day ={" "}
          <span className="text-white font-bold">{preview.total} slots</span>
          {" · "}
          <span className="text-primary">C${preview.revenue.toFixed(2)}</span> potential
        </p>
      </div>
    );
  }

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
              onClick={() => { setShowBulkForm((v) => !v); setShowBlockForm(false); setGenerateConflict(null); setError(""); }}
              className="bg-primary hover:bg-primary-hover text-white text-sm font-semibold px-4 py-2 rounded-dome transition-colors"
            >
              {showBulkForm ? "Cancel" : "⚡ Generate Slots"}
            </button>
          </div>
        </div>

        {/* ── Generate form ──────────────────────────────────────────── */}
        {showBulkForm && (
          <div className="bg-surface border border-border rounded-dome p-6 space-y-5">
            <h2 className="font-bold text-white text-base">Generate Slots</h2>

            {/* Tab bar */}
            <div className="flex p-1 bg-black/40 rounded-lg gap-1">
              {(["quick", "weekday", "weekend", "custom"] as const).map((tab) => (
                <button key={tab} type="button" onClick={() => setGenTab(tab)}
                  className={[
                    "flex-1 py-2 px-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap",
                    genTab === tab ? "bg-primary text-white" : "text-muted hover:text-white",
                  ].join(" ")}>
                  {tab === "quick" ? "⚡ Quick Setup"
                    : tab === "weekday" ? "Mon–Fri"
                    : tab === "weekend" ? "Sat–Sun"
                    : "Custom Days"}
                </button>
              ))}
            </div>

            {/* ── Quick Setup ── */}
            {genTab === "quick" && (
              <form onSubmit={(e) => { e.preventDefault(); runQuickSetup(); }} className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <DateInput label="From" value={quickForm.startDate}
                    onChange={(v) => setQuickForm((f) => ({ ...f, startDate: v }))} />
                  <DateInput label="To" value={quickForm.endDate}
                    onChange={(v) => setQuickForm((f) => ({ ...f, endDate: v }))} />
                  <DurationSelect value={quickForm.slotDurationMinutes}
                    onChange={(v) => setQuickForm((f) => ({ ...f, slotDurationMinutes: v }))} />
                  <SportSelect value={quickForm.sport}
                    onChange={(v) => setQuickForm((f) => ({ ...f, sport: v }))} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Weekday settings */}
                  <div className="bg-black/30 border border-border rounded-xl p-4 space-y-3">
                    <p className="text-xs font-bold text-primary uppercase tracking-wide">Weekdays (Mon–Fri)</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-muted mb-1">Open</label>
                        <input type="time" value={quickForm.wdStartTime}
                          onChange={(e) => setQuickForm((f) => ({ ...f, wdStartTime: e.target.value }))}
                          className={inputCls} required />
                      </div>
                      <div>
                        <label className="block text-xs text-muted mb-1">Close</label>
                        <input type="time" value={quickForm.wdEndTime}
                          onChange={(e) => setQuickForm((f) => ({ ...f, wdEndTime: e.target.value }))}
                          className={inputCls} required />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-muted mb-1">Price per slot (C$)</label>
                        <input type="number" min={1} step={0.01} value={quickForm.wdPrice}
                          onChange={(e) => setQuickForm((f) => ({ ...f, wdPrice: Number(e.target.value) }))}
                          className={inputCls} required />
                      </div>
                    </div>
                  </div>

                  {/* Weekend settings */}
                  <div className="bg-black/30 border border-border rounded-xl p-4 space-y-3">
                    <p className="text-xs font-bold text-primary uppercase tracking-wide">Weekends (Sat–Sun)</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-muted mb-1">Open</label>
                        <input type="time" value={quickForm.weStartTime}
                          onChange={(e) => setQuickForm((f) => ({ ...f, weStartTime: e.target.value }))}
                          className={inputCls} required />
                      </div>
                      <div>
                        <label className="block text-xs text-muted mb-1">Close</label>
                        <input type="time" value={quickForm.weEndTime}
                          onChange={(e) => setQuickForm((f) => ({ ...f, weEndTime: e.target.value }))}
                          className={inputCls} required />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-muted mb-1">Price per slot (C$)</label>
                        <input type="number" min={1} step={0.01} value={quickForm.wePrice}
                          onChange={(e) => setQuickForm((f) => ({ ...f, wePrice: Number(e.target.value) }))}
                          className={inputCls} required />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick preview */}
                {quickPreview && (
                  <div className="bg-black/40 border border-border rounded-xl p-4 font-mono text-xs space-y-1.5">
                    <p className="text-muted">
                      Weekdays: {quickPreview.wd?.days ?? 0} days × {quickPreview.wd?.slotsPerDay ?? 0} slots ={" "}
                      <span className="text-white">{quickPreview.wd?.total ?? 0} slots</span>
                      {" · "}C${quickPreview.wd?.revenue.toFixed(2) ?? "0.00"}
                    </p>
                    <p className="text-muted">
                      Weekends: {quickPreview.we?.days ?? 0} days × {quickPreview.we?.slotsPerDay ?? 0} slots ={" "}
                      <span className="text-white">{quickPreview.we?.total ?? 0} slots</span>
                      {" · "}C${quickPreview.we?.revenue.toFixed(2) ?? "0.00"}
                    </p>
                    <div className="border-t border-border/50 pt-1.5">
                      <p className="text-primary font-bold">
                        Total: {(quickPreview.wd?.total ?? 0) + (quickPreview.we?.total ?? 0)} slots
                        {" · "}C${((quickPreview.wd?.revenue ?? 0) + (quickPreview.we?.revenue ?? 0)).toFixed(2)} potential
                      </p>
                    </div>
                  </div>
                )}

                {error && <p className="text-red-400 text-sm">{error}</p>}
                <button type="submit" disabled={isSaving}
                  className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold py-3 rounded-dome transition-colors uppercase tracking-wide text-sm">
                  {isSaving ? "Generating…" : "Generate All Slots"}
                </button>
              </form>
            )}

            {/* ── Weekday tab ── */}
            {genTab === "weekday" && (
              <form onSubmit={(e) => { e.preventDefault(); runGenerate({ ...wdForm, weekdays: [1, 2, 3, 4, 5] }, "skip"); }} className="space-y-4">
                <p className="text-xs text-muted">ℹ️ Only Monday–Friday dates included</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <DateInput label="From" value={wdForm.startDate}
                    onChange={(v) => setWdForm((f) => ({ ...f, startDate: v }))} />
                  <DateInput label="To" value={wdForm.endDate}
                    onChange={(v) => setWdForm((f) => ({ ...f, endDate: v }))} />
                  <div>
                    <label className="block text-xs text-muted mb-1">Open</label>
                    <input type="time" value={wdForm.startTime}
                      onChange={(e) => setWdForm((f) => ({ ...f, startTime: e.target.value }))}
                      className={inputCls} required />
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1">Close</label>
                    <input type="time" value={wdForm.endTime}
                      onChange={(e) => setWdForm((f) => ({ ...f, endTime: e.target.value }))}
                      className={inputCls} required />
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1">Price per slot (C$)</label>
                    <input type="number" min={1} step={0.01} value={wdForm.priceCAD}
                      onChange={(e) => setWdForm((f) => ({ ...f, priceCAD: Number(e.target.value) }))}
                      className={inputCls} required />
                  </div>
                  <SportSelect value={wdForm.sport}
                    onChange={(v) => setWdForm((f) => ({ ...f, sport: v }))} />
                </div>
                <DurationSelect value={wdForm.slotDurationMinutes}
                  onChange={(v) => setWdForm((f) => ({ ...f, slotDurationMinutes: v }))} />
                <PreviewBox preview={singlePreview} />
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <button type="submit" disabled={isSaving}
                  className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold py-3 rounded-dome transition-colors uppercase tracking-wide text-sm">
                  {isSaving ? "Generating…" : "Generate Weekday Slots"}
                </button>
              </form>
            )}

            {/* ── Weekend tab ── */}
            {genTab === "weekend" && (
              <form onSubmit={(e) => { e.preventDefault(); runGenerate({ ...weForm, weekdays: [0, 6] }, "skip"); }} className="space-y-4">
                <p className="text-xs text-muted">ℹ️ Only Saturday–Sunday dates included</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <DateInput label="From" value={weForm.startDate}
                    onChange={(v) => setWeForm((f) => ({ ...f, startDate: v }))} />
                  <DateInput label="To" value={weForm.endDate}
                    onChange={(v) => setWeForm((f) => ({ ...f, endDate: v }))} />
                  <div>
                    <label className="block text-xs text-muted mb-1">Open</label>
                    <input type="time" value={weForm.startTime}
                      onChange={(e) => setWeForm((f) => ({ ...f, startTime: e.target.value }))}
                      className={inputCls} required />
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1">Close</label>
                    <input type="time" value={weForm.endTime}
                      onChange={(e) => setWeForm((f) => ({ ...f, endTime: e.target.value }))}
                      className={inputCls} required />
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1">Price per slot (C$)</label>
                    <input type="number" min={1} step={0.01} value={weForm.priceCAD}
                      onChange={(e) => setWeForm((f) => ({ ...f, priceCAD: Number(e.target.value) }))}
                      className={inputCls} required />
                  </div>
                  <SportSelect value={weForm.sport}
                    onChange={(v) => setWeForm((f) => ({ ...f, sport: v }))} />
                </div>
                <DurationSelect value={weForm.slotDurationMinutes}
                  onChange={(v) => setWeForm((f) => ({ ...f, slotDurationMinutes: v }))} />
                <PreviewBox preview={singlePreview} />
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <button type="submit" disabled={isSaving}
                  className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold py-3 rounded-dome transition-colors uppercase tracking-wide text-sm">
                  {isSaving ? "Generating…" : "Generate Weekend Slots"}
                </button>
              </form>
            )}

            {/* ── Custom Days tab ── */}
            {genTab === "custom" && (
              <form onSubmit={(e) => { e.preventDefault(); runGenerate({ ...customForm, weekdays: customDays }, "skip"); }} className="space-y-4">
                <div>
                  <label className="block text-xs text-muted mb-2">Select Days</label>
                  <div className="flex gap-2">
                    {DAY_LABELS.map(({ day, label }) => (
                      <button key={day} type="button"
                        onClick={() => setCustomDays((prev) =>
                          prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
                        )}
                        className={[
                          "w-10 h-10 rounded-full text-xs font-semibold border transition-colors",
                          customDays.includes(day)
                            ? "bg-primary border-primary text-white"
                            : "border-border text-muted hover:text-white hover:border-primary/50",
                        ].join(" ")}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <DateInput label="From" value={customForm.startDate}
                    onChange={(v) => setCustomForm((f) => ({ ...f, startDate: v }))} />
                  <DateInput label="To" value={customForm.endDate}
                    onChange={(v) => setCustomForm((f) => ({ ...f, endDate: v }))} />
                  <div>
                    <label className="block text-xs text-muted mb-1">Open</label>
                    <input type="time" value={customForm.startTime}
                      onChange={(e) => setCustomForm((f) => ({ ...f, startTime: e.target.value }))}
                      className={inputCls} required />
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1">Close</label>
                    <input type="time" value={customForm.endTime}
                      onChange={(e) => setCustomForm((f) => ({ ...f, endTime: e.target.value }))}
                      className={inputCls} required />
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1">Price per slot (C$)</label>
                    <input type="number" min={1} step={0.01} value={customForm.priceCAD}
                      onChange={(e) => setCustomForm((f) => ({ ...f, priceCAD: Number(e.target.value) }))}
                      className={inputCls} required />
                  </div>
                  <SportSelect value={customForm.sport}
                    onChange={(v) => setCustomForm((f) => ({ ...f, sport: v }))} />
                </div>
                <DurationSelect value={customForm.slotDurationMinutes}
                  onChange={(v) => setCustomForm((f) => ({ ...f, slotDurationMinutes: v }))} />
                <PreviewBox preview={singlePreview} />
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <button type="submit" disabled={isSaving || customDays.length === 0}
                  className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold py-3 rounded-dome transition-colors uppercase tracking-wide text-sm">
                  {isSaving ? "Generating…" : "Generate Slots"}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Conflict banner */}
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

        {/* ── Sport tabs (shared courts only) ───────────────────────── */}
        {courtInfo?.isShared && courtInfo.sports.length > 1 && (
          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-xs text-muted">🔄 Shared Court — Sport:</span>
            {courtInfo.sports.map((s) => (
              <button
                key={s}
                onClick={() => setActiveSportTab(s)}
                className={[
                  "px-3 py-1.5 text-xs font-semibold rounded-dome border transition-colors",
                  activeSportTab === s
                    ? "bg-primary border-primary text-white"
                    : "bg-surface border-border text-muted hover:text-white",
                ].join(" ")}
              >
                {SPORT_EMOJI[s] ?? ""} {s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
            {activeSportTab && (
              <button
                onClick={() => setActiveSportTab(null)}
                className="text-xs text-muted hover:text-white transition-colors px-2"
              >
                Show all
              </button>
            )}
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
                          {canAct && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(slot.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-3 h-3 accent-primary shrink-0"
                            />
                          )}

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
                              {(slot as Slot & { sport?: string }).sport && !courtInfo?.isShared && (
                                <span className="ml-1 opacity-60 text-[10px]">
                                  {SPORT_EMOJI[(slot as Slot & { sport?: string }).sport!] ?? ""}
                                </span>
                              )}
                              {slot.status === "BLOCKED" && <span className="ml-1">🔒</span>}
                            </span>
                          )}

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

      {deleteConfirm && (
        <ConfirmModal
          message="Delete this slot? This cannot be undone."
          confirmLabel="Delete slot"
          isLoading={actionLoading}
          onConfirm={() => deleteSlot(deleteConfirm)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {bulkDeleteConfirm && (
        <ConfirmModal
          message={`Delete ${selectedIds.size} slot${selectedIds.size !== 1 ? "s" : ""}? Booked slots will be skipped.`}
          confirmLabel={`Delete ${selectedIds.size} slots`}
          isLoading={actionLoading}
          onConfirm={bulkDelete}
          onCancel={() => setBulkDeleteConfirm(false)}
        />
      )}

      {bulkBlockConfirm && (
        <ConfirmModal
          message={`Block all selected available slots (${selectedIds.size})?`}
          confirmLabel="Block slots"
          isLoading={actionLoading}
          onConfirm={bulkBlock}
          onCancel={() => setBulkBlockConfirm(false)}
        />
      )}

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
