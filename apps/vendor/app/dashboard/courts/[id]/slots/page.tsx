"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Header from "../../../../../components/layout/Header";
import { api, apiFetch, type Slot } from "../../../../../lib/api";

interface BlockForm {
  startDate: string;
  endDate: string;
  reason: string;
}

const STATUS_STYLE: Record<string, string> = {
  AVAILABLE:  "bg-green-900/40 text-green-400 border-green-800",
  BOOKED:     "bg-red-900/40 text-red-400 border-red-800",
  HELD:       "bg-yellow-900/40 text-yellow-400 border-yellow-800",
  BLOCKED:    "bg-gray-800 text-muted border-gray-700",
  OPEN_GAME:  "bg-blue-900/40 text-blue-400 border-blue-800",
};

interface BulkForm {
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  priceCAD: number;
}

function DateInput({
  label,
  value,
  onChange,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function openCalendar() {
    inputRef.current?.showPicker?.();
    inputRef.current?.focus();
  }

  return (
    <div>
      <label className="block text-xs text-muted mb-1">{label}</label>
      <div className="relative">
        <input
          ref={inputRef}
          type="date"
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-black border border-border rounded-dome pl-3 pr-11 py-2 text-white text-sm focus:outline-none focus:border-primary [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
        />
        <button
          type="button"
          aria-label={`Open ${label.toLowerCase()} calendar`}
          onClick={openCalendar}
          className="absolute right-2 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded text-muted hover:text-white hover:bg-white/5 transition-colors"
        >
          📅
        </button>
      </div>
    </div>
  );
}

export default function SlotsPage() {
  const { id: courtId } = useParams<{ id: string }>();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [blockResult, setBlockResult] = useState<string | null>(null);
  const [blockForm, setBlockForm] = useState<BlockForm>({
    startDate: "",
    endDate: "",
    reason: "",
  });

  const today = new Date().toISOString().split("T")[0]!;
  const [form, setForm] = useState<BulkForm>({
    startDate: today,
    endDate: new Date(Date.now() + 7 * 24 * 3_600_000).toISOString().split("T")[0]!,
    startTime: "08:00",
    endTime:   "22:00",
    slotDurationMinutes: 60,
    priceCAD: 28,
  });

  function loadSlots() {
    setIsLoading(true);
    api.vendor.courtSlots(courtId!, today)
      .then((r) => setSlots(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => { loadSlots(); }, [courtId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleBulkGenerate(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError("");
    try {
      await apiFetch(`/vendor/courts/${courtId}/slots/bulk`, {
        method: "POST",
        body: JSON.stringify(form),
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

  // Group slots by date
  const byDate = slots.reduce<Record<string, Slot[]>>((acc, slot) => {
    const day = slot.date.split("T")[0]!;
    if (!acc[day]) acc[day] = [];
    acc[day]!.push(slot);
    return acc;
  }, {});

  const dateKeys = Object.keys(byDate).sort();

  return (
    <>
      <Header title="Slot Management" />
      <main className="flex-1 p-6 space-y-6 overflow-auto">
        <div className="flex items-center justify-between">
          <Link
            href={`/dashboard/courts/${courtId}/pricing`}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold border border-primary/50 text-primary hover:bg-primary hover:text-white rounded-dome transition-colors"
          >
            ⚡ Manage Pricing
          </Link>
          <div className="flex gap-2 text-xs">
            {Object.entries(STATUS_STYLE).map(([status, cls]) => (
              <span key={status} className={`px-2 py-0.5 rounded border ${cls}`}>
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
              onClick={() => { setShowBulkForm((v) => !v); setShowBlockForm(false); }}
              className="bg-primary hover:bg-primary-hover text-white text-sm font-semibold px-4 py-2 rounded-dome transition-colors"
            >
              {showBulkForm ? "Cancel" : "⚡ Generate Slots"}
            </button>
          </div>
        </div>

        {/* Generate slots form */}
        {showBulkForm && (
          <div className="bg-surface border border-border rounded-dome p-6">
            <h2 className="font-bold text-white mb-4">Generate Slots</h2>
            <form onSubmit={handleBulkGenerate} className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <DateInput
                label="Start Date"
                value={form.startDate}
                onChange={(value) => setForm((f) => ({ ...f, startDate: value }))}
              />
              <DateInput
                label="End Date"
                value={form.endDate}
                onChange={(value) => setForm((f) => ({ ...f, endDate: value }))}
              />
              {[
                { label: "Start Time", key: "startTime",  type: "time"   },
                { label: "End Time",   key: "endTime",    type: "time"   },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label className="block text-xs text-muted mb-1">{label}</label>
                  <input
                    type={type}
                    value={form[key as keyof BulkForm] as string}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full bg-black border border-border rounded-dome px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
                    required
                  />
                </div>
              ))}

              <div>
                <label className="block text-xs text-muted mb-1">Duration</label>
                <select
                  value={form.slotDurationMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, slotDurationMinutes: Number(e.target.value) }))}
                  className="w-full bg-black border border-border rounded-dome px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
                >
                  <option value={30}>30 min</option>
                  <option value={60}>60 min</option>
                  <option value={90}>90 min</option>
                  <option value={120}>120 min</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-muted mb-1">Price per slot (C$)</label>
                <input
                  type="number"
                  min={1}
                  step={0.01}
                  value={form.priceCAD}
                  onChange={(e) => setForm((f) => ({ ...f, priceCAD: Number(e.target.value) }))}
                  className="w-full bg-black border border-border rounded-dome px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
                  required
                />
              </div>

              {error && <p className="col-span-full text-red-400 text-sm">{error}</p>}

              <div className="col-span-full">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-dome transition-colors"
                >
                  {isSaving ? "Generating…" : "Generate"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Block dates form */}
        {showBlockForm && (
          <div className="bg-surface border border-border rounded-dome p-6">
            <h2 className="font-bold text-white mb-4">Block Dates (Maintenance)</h2>
            <form onSubmit={handleBlockDates} className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
              <DateInput
                label="Start Date"
                value={blockForm.startDate}
                onChange={(value) => setBlockForm((f) => ({ ...f, startDate: value }))}
              />
              <DateInput
                label="End Date"
                value={blockForm.endDate}
                onChange={(value) => setBlockForm((f) => ({ ...f, endDate: value }))}
              />
              <div>
                <label className="block text-xs text-muted mb-1">Reason (optional)</label>
                <input type="text" placeholder="e.g. Maintenance" value={blockForm.reason}
                  onChange={(e) => setBlockForm((f) => ({ ...f, reason: e.target.value }))}
                  className="w-full bg-black border border-border rounded-dome px-3 py-2 text-white text-sm focus:outline-none focus:border-primary" />
              </div>
              <button type="submit" disabled={isBlocking}
                className="bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-dome transition-colors">
                {isBlocking ? "Blocking…" : "Block Slots"}
              </button>
              {blockResult && <p className="col-span-full text-green-400 text-sm">{blockResult}</p>}
            </form>
          </div>
        )}

        {/* Calendar grid */}
        {/* Slot count summary */}
        {!isLoading && slots.length > 0 && (
          <div className="flex gap-4 text-sm">
            <span className="text-green-400">{slots.filter((s) => s.status === "AVAILABLE").length} available</span>
            <span className="text-red-400">{slots.filter((s) => s.status === "BOOKED").length} booked</span>
            <span className="text-muted">{slots.filter((s) => s.status === "BLOCKED").length} blocked</span>
          </div>
        )}

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
          <div className="space-y-4">
            {dateKeys.map((dateKey) => {
              const daySlots = byDate[dateKey]!;
              const d = new Date(dateKey + "T00:00:00");
              const label = d.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
              return (
                <div key={dateKey}>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">{label}</p>
                  <div className="flex flex-wrap gap-2">
                    {daySlots.map((slot) => (
                      <div
                        key={slot.id}
                        className={`px-3 py-1.5 rounded border text-xs font-medium ${STATUS_STYLE[slot.status] ?? "bg-surface border-border text-white"}`}
                      >
                        {slot.startTime}–{slot.endTime}
                        <span className="ml-1 opacity-60">C${slot.priceCAD.toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
