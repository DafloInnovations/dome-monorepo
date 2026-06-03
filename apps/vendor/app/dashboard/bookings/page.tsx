"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Header from "../../../components/layout/Header";
import DataTable from "../../../components/ui/DataTable";
import StatusBadge from "../../../components/ui/StatusBadge";
import Modal from "../../../components/ui/Modal";
import { api, type Booking } from "../../../lib/api";

function exportCsv(bookings: Booking[]) {
  const header = ["Date", "Time", "Court", "Player", "Phone", "Amount", "Status"];
  const rows = bookings.map((b) => [
    b.slot.date.split("T")[0],
    `${b.slot.startTime}–${b.slot.endTime}`,
    b.slot.court?.name ?? "",
    `${b.user.firstName} ${b.user.lastName}`,
    b.user.phone,
    `C$${b.totalCAD.toFixed(2)}`,
    b.status,
  ]);
  const csv = [header, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
  a.download = `bookings-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
}

const STATUS_OPTS = ["ALL", "CONFIRMED", "PENDING", "CANCELLED", "COMPLETED"];
const PAGE_SIZE = 20;

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function openCalendar() {
    inputRef.current?.showPicker?.();
    inputRef.current?.focus();
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="bg-black border border-border rounded-dome pl-3 pr-10 py-1.5 text-xs text-white focus:outline-none focus:border-primary [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
      />
      <button
        type="button"
        aria-label={`Open ${label.toLowerCase()} calendar`}
        onClick={openCalendar}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 grid h-7 w-7 place-items-center rounded text-muted hover:text-white hover:bg-white/5 transition-colors"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 2v4" />
          <path d="M16 2v4" />
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M3 10h18" />
        </svg>
      </button>
    </div>
  );
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [courtFilter, setCourtFilter] = useState("");

  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const courtNames = Array.from(
    new Set(bookings.map((b) => b.slot.court?.name).filter(Boolean))
  ) as string[];

  const load = useCallback(() => {
    setIsLoading(true);
    const params: Record<string, string> = { limit: String(PAGE_SIZE), page: String(page) };
    if (statusFilter !== "ALL") params["status"] = statusFilter;
    if (fromDate) params["from"] = fromDate;
    if (toDate) params["to"] = toDate;

    api.vendor.bookings(params)
      .then((r) => { setBookings(r.data); setTotal(r.total); })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setIsLoading(false));
  }, [statusFilter, fromDate, toDate, page]);

  useEffect(() => { load(); }, [load]);

  async function confirmCancel() {
    if (!cancelTarget) return;
    setIsCancelling(true);
    try {
      await api.vendor.cancelBooking(cancelTarget.id);
      setBookings((prev) =>
        prev.map((b) => b.id === cancelTarget.id ? { ...b, status: "CANCELLED" } : b)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setIsCancelling(false);
      setCancelTarget(null);
    }
  }

  const visible = courtFilter
    ? bookings.filter((b) => b.slot.court?.name === courtFilter)
    : bookings;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <>
      <Header title="Bookings" />
      <main className="flex-1 p-6 space-y-4 overflow-auto">

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_OPTS.map((s) => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                  statusFilter === s
                    ? "bg-primary text-white"
                    : "bg-surface border border-border text-muted hover:text-white"
                }`}>
                {s}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <DateInput
              label="Start date"
              value={fromDate}
              onChange={(value) => { setFromDate(value); setPage(1); }}
            />
            <span className="text-muted text-xs">–</span>
            <DateInput
              label="End date"
              value={toDate}
              onChange={(value) => { setToDate(value); setPage(1); }}
            />
            {(fromDate || toDate) && (
              <button onClick={() => { setFromDate(""); setToDate(""); setPage(1); }}
                className="text-xs text-muted hover:text-white transition-colors">✕</button>
            )}
          </div>

          {courtNames.length > 0 && (
            <select value={courtFilter} onChange={(e) => setCourtFilter(e.target.value)}
              className="bg-black border border-border rounded-dome px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary">
              <option value="">All Courts</option>
              {courtNames.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}

          <button onClick={() => exportCsv(visible)} disabled={visible.length === 0}
            className="text-xs text-muted hover:text-white transition-colors disabled:opacity-40">
            ↓ Export CSV
          </button>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <DataTable
          isLoading={isLoading}
          data={visible as unknown as Record<string, unknown>[]}
          emptyMessage="No bookings found"
          columns={[
            {
              key: "id", header: "ID",
              render: (r) => {
                const b = r as unknown as Booking;
                return <span className="text-muted font-mono text-xs">{b.id.slice(0, 8)}</span>;
              },
            },
            {
              key: "date", header: "Date",
              render: (r) => {
                const b = r as unknown as Booking;
                return new Date(b.slot.date).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
              },
            },
            {
              key: "time", header: "Time",
              render: (r) => { const b = r as unknown as Booking; return `${b.slot.startTime}–${b.slot.endTime}`; },
            },
            {
              key: "court", header: "Court",
              render: (r) => { const b = r as unknown as Booking; return b.slot.court?.name ?? "—"; },
            },
            {
              key: "player", header: "Player",
              render: (r) => {
                const b = r as unknown as Booking;
                return (
                  <span>
                    {b.user.firstName} {b.user.lastName}
                    <span className="text-muted ml-2 text-xs">{b.user.phone}</span>
                  </span>
                );
              },
            },
            {
              key: "amount", header: "Amount",
              render: (r) => { const b = r as unknown as Booking; return `C$${b.totalCAD.toFixed(2)}`; },
            },
            {
              key: "status", header: "Status",
              render: (r) => { const b = r as unknown as Booking; return <StatusBadge status={b.status} />; },
            },
            {
              key: "actions", header: "",
              render: (r) => {
                const b = r as unknown as Booking;
                if (b.status !== "CONFIRMED" && b.status !== "PENDING") return null;
                return (
                  <button onClick={() => setCancelTarget(b)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors font-medium">
                    Cancel
                  </button>
                );
              },
            },
          ]}
        />

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-muted">
            <span>{total} total · page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 bg-surface border border-border rounded-dome hover:text-white disabled:opacity-40 transition-colors">
                ← Prev
              </button>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 bg-surface border border-border rounded-dome hover:text-white disabled:opacity-40 transition-colors">
                Next →
              </button>
            </div>
          </div>
        )}
      </main>

      <Modal
        open={!!cancelTarget}
        title="Cancel Booking"
        description={
          cancelTarget
            ? `Cancel ${cancelTarget.user.firstName} ${cancelTarget.user.lastName}'s booking on ${new Date(cancelTarget.slot.date).toLocaleDateString("en-CA", { month: "short", day: "numeric" })} at ${cancelTarget.slot.startTime}? This cannot be undone.`
            : undefined
        }
        confirmLabel="Yes, Cancel"
        destructive
        isLoading={isCancelling}
        onConfirm={confirmCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </>
  );
}
