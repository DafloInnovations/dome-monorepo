"use client";

import { useCallback, useEffect, useState } from "react";
import Header from "../../../components/layout/Header";
import StatusBadge from "../../../components/ui/StatusBadge";
import { apiFetch } from "../../../lib/api";

type Frequency = "WEEKLY" | "BIWEEKLY" | "MONTHLY";
type PayModel  = "PAY_PER_SESSION" | "PAY_UPFRONT";
type SeriesStatus = "ACTIVE" | "PAUSED" | "CANCELLED" | "COMPLETED";

interface RecurringSeries {
  id: string;
  status: SeriesStatus;
  frequency: Frequency;
  daysOfWeek: number[];
  startTime: string;
  durationMinutes: number;
  startDate: string;
  endDate: string;
  totalOccurrences: number;
  completedOccurrences: number;
  pricePerSessionCAD: number;
  discountPercent: number;
  paymentModel: PayModel;
  weeklyValueCAD: number;
  totalSeriesValueCAD: number;
  user: { id: string; firstName: string; lastName: string; phone: string };
  facility: { id: string; name: string };
  court: { id: string; name: string };
  bookings: Array<{ id: string; status: string; totalCAD: number; recurringSeriesIndex: number | null }>;
}

interface VendorRecurringData {
  summary: { totalActive: number; weeklyRecurringRevenueCAD: number; retentionRate: number | null };
  series: RecurringSeries[];
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FREQ_LABELS: Record<string, string> = { WEEKLY: "Weekly", BIWEEKLY: "Biweekly", MONTHLY: "Monthly" };

function scheduleLabel(s: RecurringSeries): string {
  const days = s.daysOfWeek.map((d) => DAY_LABELS[d]).join(", ");
  const [h, m] = s.startTime.split(":").map(Number);
  const p = h! >= 12 ? "PM" : "AM";
  return `${FREQ_LABELS[s.frequency] ?? s.frequency} · ${days} · ${h! % 12 || 12}:${String(m!).padStart(2, "0")} ${p}`;
}

export default function VendorRecurringPage() {
  const [data, setData] = useState<VendorRecurringData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<SeriesStatus | "ALL">("ALL");

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch<{ data: VendorRecurringData }>("/vendor/recurring");
      setData(res.data);
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = (data?.series ?? []).filter((s) => filter === "ALL" || s.status === filter);
  const summary = data?.summary;

  return (
    <>
      <Header title="Recurring Bookings" />
      <main className="flex-1 p-6 space-y-6 overflow-auto">

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Active Series", value: isLoading ? "…" : String(summary?.totalActive ?? 0), icon: "🔄" },
            { label: "Weekly Revenue", value: isLoading ? "…" : `C$${(summary?.weeklyRecurringRevenueCAD ?? 0).toFixed(2)}`, icon: "💰" },
            { label: "Retention Rate", value: isLoading ? "…" : summary?.retentionRate != null ? `${summary.retentionRate}%` : "—", icon: "🎯" },
          ].map(({ label, value, icon }) => (
            <div key={label} className="bg-surface border border-border rounded-dome p-5">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs font-semibold text-muted uppercase tracking-wide">{label}</p>
                <span className="text-xl">{icon}</span>
              </div>
              <p className="text-2xl font-black text-white">{value}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap border-b border-border pb-4">
          {(["ALL", "ACTIVE", "PAUSED", "CANCELLED", "COMPLETED"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-1.5 text-sm font-semibold rounded-dome border transition-colors ${
                filter === f ? "bg-primary border-primary text-white" : "border-border text-muted hover:text-white hover:border-primary/50"
              }`}>
              {f}
            </button>
          ))}
          <span className="ml-auto text-xs text-muted self-center">{filtered.length} series</span>
        </div>

        {/* Series list */}
        {isLoading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-28 bg-surface border border-border rounded-dome animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted">
            <p className="text-4xl mb-3">🔄</p>
            <p className="text-sm">No recurring series{filter !== "ALL" ? ` with status ${filter.toLowerCase()}` : ""}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((s) => {
              const confirmedCount = s.bookings.filter((b) => b.status === "CONFIRMED").length;
              const paidRevenue = s.bookings.filter((b) => b.status === "CONFIRMED").reduce((sum, b) => sum + b.totalCAD, 0);

              return (
                <div key={s.id} className="bg-surface border border-border rounded-dome p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-base font-bold text-white">{s.user.firstName} {s.user.lastName}</span>
                        <StatusBadge status={s.status} />
                        {s.discountPercent > 0 && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded bg-green-900/50 text-green-400 border border-green-800/50">
                            {s.discountPercent}% OFF
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted">{s.user.phone}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-primary">C${s.weeklyValueCAD.toFixed(2)}<span className="text-xs text-muted font-normal">/wk</span></p>
                      <p className="text-xs text-muted">C${s.totalSeriesValueCAD.toFixed(2)} total</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <p className="text-muted mb-0.5">Court</p>
                      <p className="text-white font-medium">{s.facility.name} · {s.court.name}</p>
                    </div>
                    <div>
                      <p className="text-muted mb-0.5">Schedule</p>
                      <p className="text-white font-medium">{scheduleLabel(s)}</p>
                    </div>
                    <div>
                      <p className="text-muted mb-0.5">Progress</p>
                      <p className="text-white font-medium">{confirmedCount} / {s.totalOccurrences} sessions</p>
                    </div>
                    <div>
                      <p className="text-muted mb-0.5">Revenue earned</p>
                      <p className="text-white font-medium">C${paidRevenue.toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3 bg-surface-2 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-1.5 bg-primary rounded-full transition-all"
                      style={{ width: `${Math.min(100, (confirmedCount / s.totalOccurrences) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted mt-1">
                    <span>{new Date(s.startDate + "T12:00:00Z").toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</span>
                    <span>{new Date(s.endDate + "T12:00:00Z").toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</span>
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
