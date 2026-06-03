"use client";

import type { Metadata } from "next";
import { useEffect, useState } from "react";
import Link from "next/link";
import StatusBadge from "../../components/ui/StatusBadge";
import SportPill from "../../components/ui/SportPill";
import { API_URL, type OpenGame } from "../../lib/api";
import { SPORTS, getSportEmoji } from "../../lib/cities";

const SKILL_LABEL: Record<string, string> = {
  BEGINNER: "Beginner", ROOKIE: "Rookie", INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced", PRO: "Pro", ELITE: "Elite", ANY: "Any level",
};

export default function ConnectPage() {
  const [games, setGames] = useState<OpenGame[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [sportFilter, setSportFilter] = useState("");

  useEffect(() => {
    const qs = sportFilter ? `?sport=${sportFilter}` : "";
    setIsLoading(true);
    fetch(`${API_URL}/connect/games${qs}`)
      .then((r) => r.json())
      .then((json: { data: OpenGame[] }) => setGames(json.data ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setIsLoading(false));
  }, [sportFilter]);

  return (
    <main className="max-w-6xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-black text-white mb-2">Connect Games</h1>
        <p className="text-muted">Join open games near you. Split the court cost with other players.</p>
      </div>

      <section className="bg-surface border border-border rounded-[28px] px-5 py-4 mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <p className="text-xl md:text-2xl font-black text-white">
            To create a game, download the Dome app
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <span className="inline-flex items-center gap-3 bg-black border border-border rounded-[12px] px-4 py-2.5 text-white min-w-44">
              <span className="text-2xl">▶</span>
              <span className="leading-tight">
                <span className="block text-[10px] uppercase tracking-wide text-muted">Get it on</span>
                <span className="block text-sm font-bold">Google Play</span>
              </span>
            </span>
            <span className="inline-flex items-center gap-3 bg-black border border-border rounded-[12px] px-4 py-2.5 text-white min-w-44">
              <span className="text-2xl"></span>
              <span className="leading-tight">
                <span className="block text-[10px] uppercase tracking-wide text-muted">Download on the</span>
                <span className="block text-sm font-bold">App Store</span>
              </span>
            </span>
          </div>
        </div>
      </section>

      {/* Sport filter */}
      <div className="flex flex-wrap gap-2 mb-8">
        <SportPill sport="All" emoji="🏟️" active={!sportFilter} onClick={() => setSportFilter("")} />
        {SPORTS.map((s) => (
          <SportPill key={s.slug} sport={s.label} emoji={s.emoji}
            active={sportFilter === s.slug} onClick={() => setSportFilter(s.slug)} />
        ))}
      </div>

      {error && <p className="text-red-400 text-sm mb-6">{error}</p>}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-surface border border-border rounded-dome h-40 animate-pulse" />
          ))}
        </div>
      ) : games.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-5xl mb-4">🤝</p>
          <p className="text-xl font-bold text-white mb-2">No open games yet</p>
          <p className="text-muted text-sm">Check back soon or post your own game after booking a slot.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {games.map((game) => {
            const emoji = getSportEmoji(game.sport);
            const filled = game._count.participants;
            const total = game.playersNeeded;
            const city = game.facility.address?.city;
            const gameDate = new Date(game.gameDate + "T00:00:00").toLocaleDateString("en-CA", {
              weekday: "short", month: "short", day: "numeric",
            });

            return (
              <div key={game.id} className="bg-surface border border-border rounded-dome p-5 hover:border-primary/40 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{emoji}</span>
                    <div>
                      <p className="font-bold text-white">
                        {game.sport.charAt(0) + game.sport.slice(1).toLowerCase()} at {game.facility.name}
                      </p>
                      {city && <p className="text-xs text-muted">📍 {city}</p>}
                    </div>
                  </div>
                  <StatusBadge status={game.status} />
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted mb-4">
                  <span>📅 {gameDate}</span>
                  <span>🕐 {game.startTime}–{game.endTime}</span>
                  <span>🎯 {SKILL_LABEL[game.skillLevel] ?? game.skillLevel}</span>
                  <span>
                    👥 <span className={filled >= total ? "text-red-400" : "text-green-400"}>{filled}/{total}</span> players
                  </span>
                </div>

                {game.description && (
                  <p className="text-xs text-muted mb-4 line-clamp-2">{game.description}</p>
                )}

                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted">
                    Hosted by {game.host.firstName} {game.host.lastName.charAt(0)}.
                  </p>
                  <Link
                    href={`/login?redirect=/connect`}
                    className={`text-xs font-bold px-4 py-2 rounded-dome transition-colors ${
                      filled >= total || game.status !== "OPEN"
                        ? "bg-surface-2 text-muted cursor-not-allowed"
                        : "bg-primary hover:bg-primary-hover text-white"
                    }`}
                  >
                    {filled >= total ? "Full" : "Join Game"}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
