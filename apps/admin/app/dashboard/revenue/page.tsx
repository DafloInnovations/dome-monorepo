"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import Header from "../../../components/layout/Header";
import StatsCard from "../../../components/ui/StatsCard";
import { apiFetch, type RevenueData } from "../../../lib/api";

function fmtCAD(n: number) {
  return `C$${n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function BarRow({ label, amount, max }: { label: string; amount: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (amount / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-muted w-28 shrink-0 truncate capitalize">{label.toLowerCase()}</span>
      <div className="flex-1 bg-surface-2 rounded-full h-2 overflow-hidden">
        <div className="h-2 bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-white text-xs w-24 text-right shrink-0">{fmtCAD(amount)}</span>
    </div>
  );
}

export default function RevenuePage() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ data: RevenueData }>("/admin/revenue")
      .then((r) => setData(r.data))
      .catch(() => null)
      .finally(() => setIsLoading(false));
  }, []);

  const chartData = (data?.revenueByDay ?? []).map((d) => ({
    date: d.date.slice(5),
    amount: d.amount,
  }));

  const maxSport  = Math.max(...(data?.revenueBySport ?? []).map((s) => s.amount), 1);
  const maxCity   = Math.max(...(data?.revenueByCity ?? []).map((c) => c.amount), 1);
  const maxVendor = Math.max(...(data?.topVendors ?? []).map((v) => v.amount), 1);

  return (
    <>
      <Header title="Revenue" />
      <main className="flex-1 p-6 space-y-6 overflow-auto">

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            label="All-Time Revenue"
            value={isLoading ? "…" : fmtCAD(data?.totalRevenueAllTime ?? 0)}
            icon="💰"
            highlight
          />
          <StatsCard
            label="This Month"
            value={isLoading ? "…" : fmtCAD(data?.totalRevenueMonth ?? 0)}
            icon="📅"
          />
          <StatsCard
            label="Dome Commission"
            value={isLoading ? "…" : fmtCAD(data?.domeCommission ?? 0)}
            icon="🏛️"
            sub="2.9% + $0.30 per booking"
          />
          <StatsCard
            label="Total Bookings"
            value={isLoading ? "…" : (data?.totalBookings ?? 0).toLocaleString("en-CA")}
            icon="📊"
          />
        </div>

        {/* Daily revenue bar chart */}
        <div className="bg-surface border border-border rounded-dome p-5">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-5">
            Daily Revenue — Last 30 Days
          </h2>
          {isLoading ? (
            <div className="h-48 animate-pulse bg-surface-2 rounded-dome" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid vertical={false} stroke="#222" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#6B6B6B", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  interval={4}
                />
                <YAxis
                  tick={{ fill: "#6B6B6B", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => v === 0 ? "" : `$${v}`}
                  width={40}
                />
                <Tooltip
                  cursor={{ fill: "rgba(232,80,104,0.06)" }}
                  contentStyle={{ background: "#111", border: "1px solid #222", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "#6B6B6B" }}
                  formatter={(v) => [fmtCAD(Number(v)), "Revenue"]}
                />
                <Bar dataKey="amount" fill="#E85068" radius={[3, 3, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue by sport */}
          <div className="bg-surface border border-border rounded-dome p-5">
            <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-4">By Sport</h2>
            {isLoading ? (
              <div className="h-40 animate-pulse bg-surface-2 rounded-dome" />
            ) : (data?.revenueBySport ?? []).length === 0 ? (
              <p className="text-muted text-sm text-center py-8">No data</p>
            ) : (
              <div className="space-y-3">
                {(data?.revenueBySport ?? []).map((s) => (
                  <BarRow key={s.sport} label={s.sport} amount={s.amount} max={maxSport} />
                ))}
              </div>
            )}
          </div>

          {/* Revenue by city */}
          <div className="bg-surface border border-border rounded-dome p-5">
            <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-4">By City (Top 10)</h2>
            {isLoading ? (
              <div className="h-40 animate-pulse bg-surface-2 rounded-dome" />
            ) : (data?.revenueByCity ?? []).length === 0 ? (
              <p className="text-muted text-sm text-center py-8">No data</p>
            ) : (
              <div className="space-y-3">
                {(data?.revenueByCity ?? []).map((c) => (
                  <BarRow key={c.city} label={c.city} amount={c.amount} max={maxCity} />
                ))}
              </div>
            )}
          </div>

          {/* Top vendors */}
          <div className="bg-surface border border-border rounded-dome p-5">
            <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-4">Top Vendors</h2>
            {isLoading ? (
              <div className="h-40 animate-pulse bg-surface-2 rounded-dome" />
            ) : (data?.topVendors ?? []).length === 0 ? (
              <p className="text-muted text-sm text-center py-8">No data</p>
            ) : (
              <div className="space-y-4">
                {(data?.topVendors ?? []).map((v, i) => (
                  <div key={v.vendorId} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="text-xs text-muted w-4">#{i + 1}</span>
                        <span className="text-white font-medium truncate">{v.businessName}</span>
                      </span>
                      <span className="text-muted text-xs shrink-0">{v.bookings} bkgs</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-surface-2 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-1.5 bg-primary/60 rounded-full"
                          style={{ width: `${Math.min(100, (v.amount / maxVendor) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted w-20 text-right">{fmtCAD(v.amount)}</span>
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
