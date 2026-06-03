"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "../../components/layout/Header";
import StatsCard from "../../components/ui/StatsCard";
import { apiFetch, type PlatformStats, type ActivityEvent } from "../../lib/api";

const EVENT_ICON: Record<ActivityEvent["type"], string> = {
  user_signup:        "👤",
  booking_created:    "📅",
  booking_cancelled:  "❌",
  vendor_applied:     "🏟️",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function OverviewPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<{ data: PlatformStats }>("/admin/stats"),
      apiFetch<{ data: ActivityEvent[] }>("/admin/activity?limit=20"),
    ])
      .then(([s, a]) => { setStats(s.data); setActivity(a.data); })
      .catch(() => null)
      .finally(() => setIsLoading(false));
  }, []);

  const fmt = (n: number | undefined) =>
    n === undefined ? "—" : n.toLocaleString("en-CA");
  const fmtCAD = (n: number | undefined) =>
    n === undefined ? "—" : `C$${n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const hasPending = (stats?.pendingVendors ?? 0) > 0;

  return (
    <>
      <Header title="Overview" />
      <main className="flex-1 p-6 space-y-6 overflow-auto">

        {/* Pending vendors alert */}
        {hasPending && (
          <div className="flex items-center justify-between bg-primary/10 border border-primary/30 rounded-dome px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="text-xl">⏳</span>
              <div>
                <p className="text-sm font-bold text-white">
                  {stats!.pendingVendors} vendor application{stats!.pendingVendors !== 1 ? "s" : ""} awaiting review
                </p>
                <p className="text-xs text-muted">New vendors are waiting for approval to start listing facilities.</p>
              </div>
            </div>
            <Link
              href="/dashboard/vendors?status=PENDING"
              className="shrink-0 bg-primary hover:bg-primary-hover text-white text-sm font-bold px-4 py-2 rounded-dome transition-colors"
            >
              Review Now →
            </Link>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            label="Total Users"
            value={isLoading ? "…" : fmt(stats?.totalUsers)}
            sub={`${fmt(stats?.newUsersToday)} new today`}
            icon="👥"
          />
          <StatsCard
            label="Active Vendors"
            value={isLoading ? "…" : fmt(stats?.totalVendors)}
            icon="🏟️"
          />
          <StatsCard
            label="Bookings Today"
            value={isLoading ? "…" : fmt(stats?.totalBookingsToday)}
            icon="📅"
          />
          <StatsCard
            label="Revenue (MTD)"
            value={isLoading ? "…" : fmtCAD(stats?.totalRevenueMonth)}
            icon="💰"
            highlight
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <StatsCard label="New Users Today" value={isLoading ? "…" : fmt(stats?.newUsersToday)} icon="🆕" />
          <StatsCard label="New Users (7 days)" value={isLoading ? "…" : fmt(stats?.newUsersThisWeek)} icon="📈" />
          <StatsCard
            label="Pending Approvals"
            value={isLoading ? "…" : fmt(stats?.pendingVendors)}
            icon="⏳"
            urgent={hasPending}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Activity feed */}
          <div className="lg:col-span-2 bg-surface border border-border rounded-dome p-5">
            <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-4">Recent Activity</h2>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 bg-surface-2 rounded-dome animate-pulse" />
                ))}
              </div>
            ) : activity.length === 0 ? (
              <p className="text-muted text-sm text-center py-8">No recent activity</p>
            ) : (
              <div className="divide-y divide-border">
                {activity.map((e) => (
                  <div key={e.id} className="flex items-start gap-3 py-3">
                    <span className="text-base mt-0.5 shrink-0">{EVENT_ICON[e.type]}</span>
                    <div className="min-w-0 flex-1">
                      {e.href ? (
                        <Link href={e.href} className="text-sm font-medium text-white hover:text-primary truncate block">
                          {e.title}
                        </Link>
                      ) : (
                        <p className="text-sm font-medium text-white truncate">{e.title}</p>
                      )}
                      <p className="text-xs text-muted truncate">{e.sub}</p>
                    </div>
                    <span className="text-xs text-muted shrink-0">{timeAgo(e.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick links */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-muted uppercase tracking-wide">Quick Links</h2>
            {[
              { href: "/dashboard/vendors?status=PENDING", label: "Pending Vendors",  icon: "⏳", urgent: hasPending },
              { href: "/dashboard/vendors",               label: "All Vendors",       icon: "🏟️", urgent: false },
              { href: "/dashboard/users",                 label: "Manage Users",      icon: "👥", urgent: false },
              { href: "/dashboard/bookings",              label: "All Bookings",      icon: "📅", urgent: false },
              { href: "/dashboard/revenue",               label: "Revenue Report",    icon: "💰", urgent: false },
            ].map(({ href, label, icon, urgent }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 border rounded-dome px-4 py-3 text-sm font-medium transition-colors ${
                  urgent
                    ? "bg-primary/5 border-primary/40 text-primary hover:border-primary"
                    : "bg-surface border-border text-muted hover:text-white hover:border-primary/50"
                }`}
              >
                <span className="text-base">{icon}</span>
                {label}
              </Link>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
