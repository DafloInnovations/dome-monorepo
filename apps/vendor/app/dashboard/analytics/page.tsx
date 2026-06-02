"use client";

import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from "recharts";
import Header from "../../../components/layout/Header";
import StatsCard from "../../../components/ui/StatsCard";
import { api, type AnalyticsData } from "../../../lib/api";

const SPORT_EMOJI: Record<string, string> = {
  SOCCER: "⚽", BASKETBALL: "🏀", TENNIS: "🎾", BADMINTON: "🏸",
  VOLLEYBALL: "🏐", HOCKEY: "🏒", SQUASH: "🎯", PICKLEBALL: "🏓",
};

const CHART_STYLE = {
  grid: "#222",
  tick: "#6B6B6B",
  tooltip: { background: "#111", border: "1px solid #222", borderRadius: 8 },
};

function formatHour(h: number) {
  if (h === 0) return "12a";
  if (h < 12) return `${h}a`;
  if (h === 12) return "12p";
  return `${h - 12}p`;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.vendor.analytics()
      .then((r) => setData(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setIsLoading(false));
  }, []);

  // Peak hour for display
  const peakHour = data?.peakHours.reduce((best, h) => h.count > best.count ? h : best, { hour: 0, count: 0 });

  // Most popular court
  const mostPopularCourt = data?.occupancyRateByCourt.reduce(
    (best, c) => c.occupancyRate > best.occupancyRate ? c : best,
    { courtName: "—", occupancyRate: 0, courtId: "", totalSlots: 0, bookedSlots: 0 }
  );

  return (
    <>
      <Header title="Analytics" />
      <main className="flex-1 p-6 space-y-6 overflow-auto">
        {error && <p className="text-red-400 text-sm">{error}</p>}

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            label="Revenue This Month"
            value={isLoading ? "—" : `C$${data?.totalRevenueMonth.toFixed(2) ?? "0.00"}`}
            icon="💰"
          />
          <StatsCard
            label="Avg Booking Value"
            value={isLoading ? "—" : `C$${data?.avgBookingValue.toFixed(2) ?? "0.00"}`}
            icon="📊"
          />
          <StatsCard
            label="Cancellation Rate"
            value={isLoading ? "—" : `${data?.cancellationRate ?? 0}%`}
            icon="📉"
          />
          <StatsCard
            label="Peak Booking Hour"
            value={isLoading ? "—" : (peakHour?.count ? formatHour(peakHour.hour) : "—")}
            icon="⏰"
          />
        </div>

        {/* Revenue + Bookings charts side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface border border-border rounded-dome p-6">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-4">
              Revenue — Last 30 Days
            </h2>
            {isLoading ? (
              <div className="h-48 animate-pulse bg-surface-2 rounded" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data?.revenueByDay ?? []} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.grid} />
                  <XAxis dataKey="date" tick={{ fill: CHART_STYLE.tick, fontSize: 10 }}
                    tickFormatter={(v: string) => v.slice(5)} interval={4} />
                  <YAxis tick={{ fill: CHART_STYLE.tick, fontSize: 10 }}
                    tickFormatter={(v: number) => `$${v}`} />
                  <Tooltip contentStyle={CHART_STYLE.tooltip} labelStyle={{ color: "#fff" }}
                    formatter={(v) => [`C$${Number(v).toFixed(2)}`, "Revenue"]} />
                  <Line type="monotone" dataKey="amount" stroke="#E85068" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-surface border border-border rounded-dome p-6">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-4">
              Bookings — Last 30 Days
            </h2>
            {isLoading ? (
              <div className="h-48 animate-pulse bg-surface-2 rounded" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data?.bookingsByDay ?? []} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.grid} />
                  <XAxis dataKey="date" tick={{ fill: CHART_STYLE.tick, fontSize: 10 }}
                    tickFormatter={(v: string) => v.slice(5)} interval={4} />
                  <YAxis tick={{ fill: CHART_STYLE.tick, fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={CHART_STYLE.tooltip} labelStyle={{ color: "#fff" }}
                    formatter={(v: number) => [v, "Bookings"]} />
                  <Bar dataKey="count" fill="#E85068" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Peak hours heatmap */}
        <div className="bg-surface border border-border rounded-dome p-6">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-4">
            Peak Booking Hours
          </h2>
          {isLoading ? (
            <div className="h-16 animate-pulse bg-surface-2 rounded" />
          ) : (
            <div className="flex gap-1 items-end">
              {(data?.peakHours ?? []).filter((h) => h.hour >= 6 && h.hour <= 23).map((h) => {
                const maxCount = Math.max(...(data?.peakHours ?? []).map((x) => x.count), 1);
                const pct = maxCount > 0 ? Math.round((h.count / maxCount) * 100) : 0;
                return (
                  <div key={h.hour} className="flex flex-col items-center gap-1 flex-1">
                    <div
                      className="w-full rounded-t"
                      style={{
                        height: Math.max(4, (pct / 100) * 64),
                        background: pct > 60 ? "#E85068" : pct > 30 ? "#C73D55" : "#2A2A2A",
                      }}
                      title={`${h.count} bookings`}
                    />
                    <span className="text-[9px] text-muted">{formatHour(h.hour)}</span>
                  </div>
                );
              })}
            </div>
          )}
          {!isLoading && peakHour && peakHour.count > 0 && (
            <p className="text-xs text-muted mt-3">
              Busiest hour: <span className="text-white">{formatHour(peakHour.hour)}</span> ({peakHour.count} bookings)
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top sports */}
          <div className="bg-surface border border-border rounded-dome p-6">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-4">
              Top Sports
            </h2>
            {isLoading ? (
              <div className="h-32 animate-pulse bg-surface-2 rounded" />
            ) : (
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={data?.topSports ?? []} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.grid} />
                  <XAxis dataKey="sport" tick={{ fill: CHART_STYLE.tick, fontSize: 10 }}
                    tickFormatter={(v: string) => SPORT_EMOJI[v] ?? v.slice(0, 3)} />
                  <YAxis tick={{ fill: CHART_STYLE.tick, fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={CHART_STYLE.tooltip} labelStyle={{ color: "#fff" }} />
                  <Bar dataKey="count" fill="#E85068" radius={[4, 4, 0, 0]}>
                    {(data?.topSports ?? []).map((_, i) => (
                      <Cell key={i} fill="#E85068" opacity={1 - i * 0.12} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Occupancy by court */}
          <div className="bg-surface border border-border rounded-dome p-6">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-4">
              Occupancy by Court
              {mostPopularCourt && mostPopularCourt.courtName !== "—" && (
                <span className="ml-2 text-primary font-normal normal-case text-xs">
                  · most popular: {mostPopularCourt.courtName}
                </span>
              )}
            </h2>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-8 animate-pulse bg-surface-2 rounded" />)}
              </div>
            ) : (data?.occupancyRateByCourt ?? []).length === 0 ? (
              <p className="text-sm text-muted">No court data</p>
            ) : (
              <div className="space-y-3">
                {data!.occupancyRateByCourt.map((c) => (
                  <div key={c.courtId}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-white">{c.courtName}</span>
                      <span className="text-muted">{c.occupancyRate}% · {c.bookedSlots}/{c.totalSlots} slots</span>
                    </div>
                    <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${c.occupancyRate}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
