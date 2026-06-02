"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { clearToken, isAuthenticated } from "../../lib/auth";
import { getSportEmoji } from "../../lib/cities";

interface ProfileData {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    avatarUrl: string | null;
    province: string;
    creditBalanceCAD: number;
    createdAt: string;
  };
  stats: {
    totalGames: number;
    totalHours: number;
    totalPoints: number;
    currentStreak: number;
    tier: string;
    sportBreakdown: Record<string, number>;
  };
}

const TIER_COLORS: Record<string, string> = {
  BRONZE:   "text-orange-400",
  SILVER:   "text-gray-300",
  GOLD:     "text-yellow-400",
  PLATINUM: "text-cyan-400",
  ELITE:    "text-primary",
};

const TIER_BADGE: Record<string, string> = {
  BRONZE:   "🥉", SILVER: "🥈", GOLD: "🥇", PLATINUM: "💎", ELITE: "🔥",
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState("");

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login?redirect=/profile");
      return;
    }
    apiFetch<{ data: ProfileData }>("/users/me/profile")
      .then((r) => setProfile(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load profile"))
      .finally(() => setIsLoading(false));
  }, [router]);

  function handleSignOut() {
    clearToken();
    router.push("/");
  }

  if (isLoading) return (
    <main className="max-w-2xl mx-auto px-4 py-16 text-center">
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-surface border border-border rounded-dome h-24 animate-pulse" />
        ))}
      </div>
    </main>
  );

  if (error || !profile) return (
    <main className="max-w-2xl mx-auto px-4 py-16 text-center">
      <p className="text-red-400">{error || "Profile not found"}</p>
    </main>
  );

  const { user, stats } = profile;
  const displayName = `${user.firstName} ${user.lastName}`.trim() || "Player";
  const tier        = stats.tier ?? "BRONZE";
  const xpPct       = Math.min(100, (stats.totalPoints % 1000) / 10); // 0–100%
  const memberSince = new Date(user.createdAt).toLocaleDateString("en-CA", { month: "long", year: "numeric" });

  const topSports = Object.entries(stats.sportBreakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">

      {/* Avatar + identity */}
      <div className="bg-surface border border-border rounded-dome p-6 mb-4 flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center text-2xl font-black text-primary shrink-0">
          {displayName[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-black text-white">{displayName}</h1>
            <span className={`text-sm font-bold ${TIER_COLORS[tier] ?? "text-muted"}`}>
              {TIER_BADGE[tier]} {tier}
            </span>
          </div>
          <p className="text-sm text-muted mt-0.5">{user.phone}</p>
          <p className="text-xs text-muted mt-0.5">Member since {memberSince} · {user.province}</p>
        </div>
      </div>

      {/* XP bar */}
      <div className="bg-surface border border-border rounded-dome p-5 mb-4">
        <div className="flex justify-between text-xs mb-2">
          <span className="text-muted font-semibold uppercase tracking-wide">Progress to next tier</span>
          <span className="text-white font-bold">{stats.totalPoints} pts</span>
        </div>
        <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${xpPct}%` }}
          />
        </div>
        <p className="text-xs text-muted mt-1">{Math.round(1000 - (stats.totalPoints % 1000))} pts to next tier</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Games Played", value: stats.totalGames,     icon: "🏆" },
          { label: "Hours Played", value: `${stats.totalHours}h`, icon: "⏱️" },
          { label: "Dome Points",  value: stats.totalPoints,    icon: "⚡" },
          { label: "Day Streak",   value: `${stats.currentStreak}🔥`, icon: "📅" },
        ].map(({ label, value, icon }) => (
          <div key={label} className="bg-surface border border-border rounded-dome p-4 text-center">
            <p className="text-xl mb-1">{icon}</p>
            <p className="text-xl font-black text-white">{value}</p>
            <p className="text-xs text-muted mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Dome credits */}
      <div className="bg-primary/10 border border-primary/30 rounded-dome p-5 mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">Dome Credits</p>
          <p className="text-2xl font-black text-primary">C${Number(user.creditBalanceCAD).toFixed(2)}</p>
          <p className="text-xs text-muted mt-0.5">Applied automatically at checkout</p>
        </div>
        <span className="text-4xl">🎁</span>
      </div>

      {/* Sport breakdown */}
      {topSports.length > 0 && (
        <div className="bg-surface border border-border rounded-dome p-5 mb-4">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-4">Sport Breakdown</p>
          <div className="space-y-3">
            {topSports.map(([sport, count]) => {
              const pct = Math.round((count / stats.totalGames) * 100);
              return (
                <div key={sport}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-white">{getSportEmoji(sport)} {sport.charAt(0) + sport.slice(1).toLowerCase()}</span>
                    <span className="text-muted">{count} game{count !== 1 ? "s" : ""} · {pct}%</span>
                  </div>
                  <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        className="w-full border border-red-800 text-red-400 hover:bg-red-900/20 font-semibold py-3 rounded-dome text-sm transition-colors"
      >
        Sign Out
      </button>
    </main>
  );
}
