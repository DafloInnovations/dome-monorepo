"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "../../components/layout/Header";
import StatsCard from "../../components/ui/StatsCard";
import DataTable from "../../components/ui/DataTable";
import StatusBadge from "../../components/ui/StatusBadge";
import { useVendorProfile } from "../../components/layout/VendorProfileProvider";
import { api, type AnalyticsData, type Booking } from "../../lib/api";

export default function DashboardPage() {
  const { businessName } = useVendorProfile();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.vendor.analytics(),
      api.vendor.bookings({ limit: "10" }),
    ])
      .then(([a, b]) => {
        setAnalytics(a.data);
        setBookings(b.data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <>
      <Header title="Dashboard" />
      <main className="flex-1 p-6 space-y-6 overflow-auto">
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

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            label="Today's Bookings"
            value={isLoading ? "—" : analytics?.todayBookings ?? 0}
            icon="📅"
          />
          <StatsCard
            label="Revenue This Month"
            value={isLoading ? "—" : `C$${analytics?.totalRevenueMonth.toFixed(2) ?? "0.00"}`}
            icon="💰"
          />
          <StatsCard
            label="Active Courts"
            value={isLoading ? "—" : analytics?.occupancyRateByCourt.length ?? 0}
            icon="🏟"
          />
          <StatsCard
            label="Occupancy Rate"
            value={isLoading ? "—" : `${analytics?.overallOccupancyRate ?? 0}%`}
            icon="📈"
          />
        </div>

        {/* Quick actions */}
        <div>
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
            Quick Actions
          </h2>
          <div className="flex flex-wrap gap-3">
            {[
              { href: "/dashboard/facilities/new", label: "+ Add Sport", icon: "🏟" },
              { href: "/dashboard/facilities",     label: "Generate Slots", icon: "⚡" },
              { href: "/dashboard/analytics",      label: "View Analytics", icon: "📊" },
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

        {/* Recent bookings */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">
              Recent Bookings
            </h2>
            <Link href="/dashboard/bookings" className="text-xs text-primary hover:underline">
              View all →
            </Link>
          </div>

          <DataTable
            isLoading={isLoading}
            data={bookings as unknown as Record<string, unknown>[]}
            emptyMessage="No bookings yet"
            columns={[
              { key: "date",     header: "Date",    render: (row) => { const b = row as unknown as Booking; return new Date(b.slot.date).toLocaleDateString("en-CA", { month: "short", day: "numeric" }); } },
              { key: "time",     header: "Time",    render: (row) => { const b = row as unknown as Booking; return `${b.slot.startTime}–${b.slot.endTime}`; } },
              { key: "court",    header: "Court",   render: (row) => { const b = row as unknown as Booking; return b.slot.court?.name ?? "—"; } },
              { key: "player",   header: "Player",  render: (row) => { const b = row as unknown as Booking; return `${b.user.firstName} ${b.user.lastName}`; } },
              { key: "amount",   header: "Amount",  render: (row) => { const b = row as unknown as Booking; return `C$${b.totalCAD.toFixed(2)}`; } },
              { key: "status",   header: "Status",  render: (row) => { const b = row as unknown as Booking; return <StatusBadge status={b.status} />; } },
            ]}
          />
        </div>
      </main>
    </>
  );
}
