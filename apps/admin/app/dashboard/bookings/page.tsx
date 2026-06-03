"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Header from "../../../components/layout/Header";
import DataTable from "../../../components/ui/DataTable";
import StatusBadge from "../../../components/ui/StatusBadge";
import { apiFetch, type AdminBooking } from "../../../lib/api";

const STATUS_OPTS = ["ALL", "CONFIRMED", "PENDING", "CANCELLED", "COMPLETED"];
const PAGE_SIZE = 25;

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="relative">
      <input ref={ref} type="date" value={value} onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="bg-black border border-border rounded-dome pl-3 pr-10 py-1.5 text-xs text-white focus:outline-none focus:border-primary [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none" />
      <button type="button" aria-label={`Open ${label.toLowerCase()} calendar`}
        onClick={() => { ref.current?.showPicker?.(); ref.current?.focus(); }}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 grid h-7 w-7 place-items-center rounded text-muted hover:text-white hover:bg-white/5 transition-colors text-sm">
        📅
      </button>
    </div>
  );
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(() => {
    setIsLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (status !== "ALL") qs.set("status", status);
    if (fromDate) qs.set("from", fromDate);
    if (toDate) qs.set("to", toDate);
    apiFetch<{ data: AdminBooking[]; total: number }>(`/admin/bookings?${qs}`)
      .then((r) => { setBookings(r.data); setTotal(r.total); })
      .catch(() => null)
      .finally(() => setIsLoading(false));
  }, [page, status, fromDate, toDate]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <Header title="Bookings" />
      <main className="flex-1 p-6 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          {STATUS_OPTS.map((s) => (
            <button key={s} onClick={() => { setStatus(s); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-dome border transition-colors ${
                status === s
                  ? "bg-primary border-primary text-white"
                  : "border-border text-muted hover:text-white hover:border-primary/50"
              }`}>
              {s}
            </button>
          ))}

          <div className="flex items-center gap-2 ml-auto">
            <DateInput label="From date" value={fromDate} onChange={(v) => { setFromDate(v); setPage(1); }} />
            <span className="text-muted text-xs">–</span>
            <DateInput label="To date" value={toDate} onChange={(v) => { setToDate(v); setPage(1); }} />
            {(fromDate || toDate) && (
              <button onClick={() => { setFromDate(""); setToDate(""); setPage(1); }}
                className="text-xs text-muted hover:text-white transition-colors">✕</button>
            )}
          </div>

          <span className="text-xs text-muted">{total} bookings</span>
        </div>

        <DataTable
          isLoading={isLoading}
          data={bookings as unknown as Record<string, unknown>[]}
          emptyMessage="No bookings found"
          columns={[
            {
              key: "facility",
              header: "Facility",
              render: (r) => {
                const b = r as unknown as AdminBooking;
                return (
                  <div>
                    <p className="text-white font-medium">{b.facility.name}</p>
                    <p className="text-xs text-muted capitalize">{b.facility.sport.toLowerCase()}</p>
                  </div>
                );
              },
            },
            {
              key: "user",
              header: "User",
              render: (r) => {
                const b = r as unknown as AdminBooking;
                return (
                  <div>
                    <p className="text-white">{`${b.user.firstName} ${b.user.lastName}`.trim() || "—"}</p>
                    <p className="text-xs text-muted">{b.user.phone}</p>
                  </div>
                );
              },
            },
            {
              key: "slot",
              header: "Date & Time",
              render: (r) => {
                const b = r as unknown as AdminBooking;
                return (
                  <div>
                    <p className="text-white">{b.slot.date}</p>
                    <p className="text-xs text-muted">{b.slot.startTime}–{b.slot.endTime}</p>
                  </div>
                );
              },
            },
            {
              key: "totalCAD",
              header: "Amount",
              render: (r) => `C$${(r as unknown as AdminBooking).totalCAD.toFixed(2)}`,
            },
            {
              key: "status",
              header: "Status",
              render: (r) => <StatusBadge status={(r as unknown as AdminBooking).status} />,
            },
            {
              key: "createdAt",
              header: "Booked",
              render: (r) => new Date((r as unknown as AdminBooking).createdAt).toLocaleDateString("en-CA"),
            },
          ]}
        />

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between text-xs text-muted">
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
      </main>
    </>
  );
}
