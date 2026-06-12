"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Header from "../../components/layout/Header";
import StatsCard from "../../components/ui/StatsCard";
import DataTable from "../../components/ui/DataTable";
import StatusBadge from "../../components/ui/StatusBadge";
import { useVendorProfile } from "../../components/layout/VendorProfileProvider";
import { api, type DashboardData, type Booking } from "../../lib/api";

// ─── Date preset helpers ──────────────────────────────────────────────────────

type Preset = "today" | "yesterday" | "this_week" | "this_month" | "last_month" | "custom";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "today",      label: "Today"      },
  { key: "yesterday",  label: "Yesterday"  },
  { key: "this_week",  label: "This Week"  },
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "custom",     label: "📅 Custom"  },
];

function toISO(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

function getPresetDates(preset: Preset): { start: string; end: string } {
  const now = new Date();
  const today = toISO(now);

  switch (preset) {
    case "today":
      return { start: today, end: today };

    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const s = toISO(y);
      return { start: s, end: s };
    }

    case "this_week": {
      const d = new Date(now);
      const day = d.getDay();
      d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
      return { start: toISO(d), end: today };
    }

    case "this_month": {
      const s = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      return { start: s, end: today };
    }

    case "last_month": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last  = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: toISO(first), end: toISO(last) };
    }

    default:
      return { start: today, end: today };
  }
}

function daysBetween(start: string, end: string): number {
  return Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / 86_400_000
  ) + 1;
}

const BOOKING_STATUS_OPTS = ["ALL", "CONFIRMED", "PENDING", "CANCELLED", "COMPLETED"] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { businessName } = useVendorProfile();

  const [activePreset, setActivePreset] = useState<Preset>("this_month");
  const [customStart,  setCustomStart]  = useState("");
  const [customEnd,    setCustomEnd]    = useState("");

  const [dashData,  setDashData]  = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState("");

  const [playerSearch,   setPlayerSearch]   = useState("");
  const [statusFilter,   setStatusFilter]   = useState("ALL");
  const [courtFilter,    setCourtFilter]    = useState("");

  const fetchDashboard = useCallback(async (start: string, end: string) => {
    setIsLoading(true);
    setError("");
    try {
      const res = await api.vendor.dashboard({ startDate: start, endDate: end });
      setDashData(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch whenever a non-custom preset is selected
  useEffect(() => {
    if (activePreset === "custom") return;
    const { start, end } = getPresetDates(activePreset);
    fetchDashboard(start, end);
  }, [activePreset, fetchDashboard]);

  function handlePresetClick(preset: Preset) {
    setActivePreset(preset);
    if (preset !== "custom") {
      setCustomStart("");
      setCustomEnd("");
    }
  }

  function handleApplyCustom() {
    if (!customStart || !customEnd) return;
    fetchDashboard(customStart, customEnd);
  }

  // ── Derived display values ──────────────────────────────────────────────────
  const activeDateLabel =
    activePreset === "custom" && customStart && customEnd
      ? `${customStart} → ${customEnd}`
      : PRESETS.find((p) => p.key === activePreset)?.label ?? "";

  const stats      = dashData?.stats;
  const bookings   = dashData?.bookings ?? [];
  const isCustomApplied = activePreset === "custom" && !!dashData;

  const courtNames = useMemo(
    () => Array.from(new Set(bookings.map((b) => b.slot?.court?.name).filter(Boolean))) as string[],
    [bookings]
  );

  const filteredBookings = useMemo(() => {
    let result = bookings;
    if (statusFilter !== "ALL") {
      result = result.filter((b) => b.status === statusFilter);
    }
    if (courtFilter) {
      result = result.filter((b) => b.slot?.court?.name === courtFilter);
    }
    if (playerSearch.trim()) {
      const q = playerSearch.trim().toLowerCase();
      result = result.filter((b) =>
        `${b.user.firstName} ${b.user.lastName}`.toLowerCase().includes(q)
      );
    }
    return result;
  }, [bookings, statusFilter, courtFilter, playerSearch]);

  return (
    <>
      <Header title="Dashboard" />
      <main className="flex-1 p-6 space-y-6 overflow-auto">

        {/* Page heading */}
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">Dashboard</p>
          <h2 className="mt-1 text-2xl font-black text-white">
            Welcome back, {businessName}
          </h2>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-dome px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Quick actions */}
        <div>
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
            Quick Actions
          </h2>
          <div className="flex flex-wrap gap-3">
            {[
              { href: "/dashboard/facilities/new", label: "+ Add Sport",      icon: "🏟" },
              { href: "/dashboard/facilities",     label: "Generate Slots",   icon: "⚡" },
              { href: "/dashboard/analytics",      label: "View Analytics",   icon: "📊" },
            ].map(({ href, label, icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 bg-surface border border-border rounded-dome px-4 py-2.5 text-sm text-white hover:border-primary/50 hover:bg-surface-2 transition-colors"
              >
                <span>{icon}</span>
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* ── Date filter bar ─────────────────────────────────────────────── */}
        <div className="border-b border-border pb-5">
          {/* Preset pills */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {PRESETS.map((preset) => (
              <button
                key={preset.key}
                onClick={() => handlePresetClick(preset.key)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                  activePreset === preset.key
                    ? "bg-primary text-white"
                    : "bg-surface border border-border text-muted hover:text-white hover:border-primary/40"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Custom range inputs */}
          {activePreset === "custom" && (
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted font-semibold">From</label>
                <input
                  type="date"
                  value={customStart}
                  max={customEnd || undefined}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="bg-surface border border-border rounded-dome px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted font-semibold">To</label>
                <input
                  type="date"
                  value={customEnd}
                  min={customStart || undefined}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="bg-surface border border-border rounded-dome px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary"
                />
              </div>
              <button
                onClick={handleApplyCustom}
                disabled={!customStart || !customEnd}
                className="px-5 py-1.5 rounded-dome text-sm font-bold bg-primary text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
              >
                Apply
              </button>
              {customStart && customEnd && (
                <span className="text-xs text-muted">
                  {daysBetween(customStart, customEnd)} day{daysBetween(customStart, customEnd) !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Active range label */}
        {(dashData || isLoading) && (
          <p className="text-xs text-muted -mt-2">
            Showing data for{" "}
            <span className="text-primary font-semibold">{activeDateLabel}</span>
            {dashData?.dateRange && (
              <span className="ml-1">
                ({dashData.dateRange.startDate} → {dashData.dateRange.endDate})
              </span>
            )}
          </p>
        )}

        {/* ── Stats cards ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            label="Total Bookings"
            value={isLoading ? "—" : stats?.totalBookings ?? 0}
            icon="📅"
          />
          <StatsCard
            label="Revenue"
            value={isLoading ? "—" : `C$${(stats?.revenue ?? 0).toFixed(2)}`}
            icon="💰"
          />
          <StatsCard
            label="Active Courts"
            value={isLoading ? "—" : stats?.activeCourts ?? 0}
            icon="🏟"
          />
          <StatsCard
            label="Occupancy Rate"
            value={isLoading ? "—" : `${stats?.occupancyRate ?? 0}%`}
            icon="📈"
          />
        </div>

        {/* Confirmed / Cancelled / Pending mini-row */}
        {!isLoading && stats && (
          <div className="flex flex-wrap gap-3">
            {[
              { label: "Confirmed", value: stats.confirmedBookings, color: "text-green-400"  },
              { label: "Cancelled", value: stats.cancelledBookings, color: "text-red-400"    },
              { label: "Pending",   value: stats.pendingBookings,   color: "text-yellow-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-surface border border-border rounded-xl px-5 py-3 text-sm">
                <span className={`font-black text-lg ${color}`}>{value}</span>
                <span className="ml-2 text-muted">{label}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Bookings table ──────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">
              Bookings
            </h2>
            <Link href="/dashboard/bookings" className="text-xs text-primary hover:underline">
              View all →
            </Link>
          </div>

          {/* Search + filters */}
          {!isLoading && bookings.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {/* Player search */}
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  placeholder="Search player…"
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                  className="bg-surface border border-border rounded-dome pl-7 pr-3 py-1.5 text-xs text-white placeholder:text-muted focus:outline-none focus:border-primary w-40"
                />
                {playerSearch && (
                  <button onClick={() => setPlayerSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-white text-xs">✕</button>
                )}
              </div>

              {/* Status pills */}
              <div className="flex gap-1.5 flex-wrap">
                {BOOKING_STATUS_OPTS.map((s) => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                      statusFilter === s
                        ? "bg-primary text-white"
                        : "bg-surface border border-border text-muted hover:text-white"
                    }`}>
                    {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>

              {/* Court dropdown */}
              {courtNames.length > 1 && (
                <select value={courtFilter} onChange={(e) => setCourtFilter(e.target.value)}
                  className="bg-black border border-border rounded-dome px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary">
                  <option value="">All Courts</option>
                  {courtNames.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}

              {/* Active filter count */}
              {(statusFilter !== "ALL" || courtFilter || playerSearch) && (
                <button
                  onClick={() => { setStatusFilter("ALL"); setCourtFilter(""); setPlayerSearch(""); }}
                  className="text-xs text-muted hover:text-white transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          {!isLoading && bookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-surface border border-border rounded-xl">
              <span className="text-5xl mb-4">📅</span>
              <p className="text-white font-bold text-base">No bookings in this period</p>
              <p className="text-muted text-sm mt-1">Try selecting a different date range</p>
            </div>
          ) : (
            <DataTable
              isLoading={isLoading}
              data={filteredBookings as unknown as Record<string, unknown>[]}
              emptyMessage="No bookings match your filters"
              columns={[
                {
                  key: "date",
                  header: "Date",
                  render: (row) => {
                    const b = row as unknown as Booking;
                    return b.slot
                      ? new Date(b.slot.date).toLocaleDateString("en-CA", { month: "short", day: "numeric" })
                      : "Walk-in";
                  },
                },
                {
                  key: "time",
                  header: "Time",
                  render: (row) => {
                    const b = row as unknown as Booking;
                    return b.slot ? `${b.slot.startTime}–${b.slot.endTime}` : "—";
                  },
                },
                {
                  key: "court",
                  header: "Court",
                  render: (row) => {
                    const b = row as unknown as Booking;
                    return b.slot?.court?.name ?? "—";
                  },
                },
                {
                  key: "player",
                  header: "Player",
                  render: (row) => {
                    const b = row as unknown as Booking;
                    return `${b.user.firstName} ${b.user.lastName}`;
                  },
                },
                {
                  key: "amount",
                  header: "Amount",
                  render: (row) => {
                    const b = row as unknown as Booking;
                    return `C$${b.totalCAD.toFixed(2)}`;
                  },
                },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => {
                    const b = row as unknown as Booking;
                    return <StatusBadge status={b.status} />;
                  },
                },
              ]}
            />
          )}
        </div>

      </main>
    </>
  );
}
