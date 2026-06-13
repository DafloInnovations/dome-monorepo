"use client";

import { useEffect, useRef, useState } from "react";
import { API_URL, type OpenGame } from "../../lib/api";
import { SPORTS, getSportEmoji } from "../../lib/cities";
import StatusBadge from "../../components/ui/StatusBadge";
import SportPill from "../../components/ui/SportPill";

// ─── Update these when the apps are published ─────────────────────────────────
const GOOGLE_PLAY_URL = "https://play.google.com/store/apps/details?id=com.domeapp";
const APP_STORE_URL   = "https://apps.apple.com/app/dome/id6746543849";

const SKILL_LABEL: Record<string, string> = {
  BEGINNER: "Beginner", ROOKIE: "Rookie", INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced", PRO: "Pro", ELITE: "Elite", ANY: "Any level",
};

// ─── App Download Modal ───────────────────────────────────────────────────────

function AppDownloadModal({ onClose }: { onClose: () => void }) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on backdrop click
  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="w-full max-w-md rounded-[24px] border border-border p-8 shadow-2xl"
        style={{ backgroundColor: "#121212" }}
      >
        {/* Icon */}
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-[18px] bg-primary/15 border border-primary/30 flex items-center justify-center text-3xl">
            🏟️
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-black text-white text-center mb-3">
          Join on the Dome App
        </h2>

        {/* Body */}
        <p className="text-muted text-sm text-center leading-relaxed mb-8">
          Connect Games is available exclusively on the Dome mobile app.
          Download the app to join games, split court costs, and play with
          others near you.
        </p>

        {/* Store buttons */}
        <div className="flex flex-col gap-3 mb-5">
          <a
            href={GOOGLE_PLAY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 rounded-[14px] border border-border px-5 py-3.5 transition-colors hover:border-primary/50 hover:bg-white/5"
            style={{ backgroundColor: "#000" }}
          >
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
              <path d="M3.18 23.76c.34.19.73.22 1.1.07l13.02-7.52-2.8-2.8L3.18 23.76z" fill="#EA4335"/>
              <path d="M22.27 10.44l-3.08-1.78-3.09 3.09 3.09 3.08 3.1-1.79a1.72 1.72 0 0 0 0-2.6z" fill="#FBBC04"/>
              <path d="M2.07.91A1.72 1.72 0 0 0 1.5 2.2v19.6c0 .52.22 1 .57 1.32l.07.06L14.5 11.31v-.29L2.14.85l-.07.06z" fill="#4285F4"/>
              <path d="M16.3 14.31l-2.8-2.8v-.29l2.8-2.8 3.1 1.78L16.3 14.3z" fill="#34A853"/>
            </svg>
            <div className="leading-tight">
              <span className="block text-[10px] uppercase tracking-wide text-muted">Get it on</span>
              <span className="block text-sm font-bold text-white">Google Play</span>
            </div>
          </a>

          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 rounded-[14px] border border-border px-5 py-3.5 transition-colors hover:border-primary/50 hover:bg-white/5"
            style={{ backgroundColor: "#000" }}
          >
            <svg viewBox="0 0 24 24" width="28" height="28" fill="white">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83zM13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            <div className="leading-tight">
              <span className="block text-[10px] uppercase tracking-wide text-muted">Download on the</span>
              <span className="block text-sm font-bold text-white">App Store</span>
            </div>
          </a>
        </div>

        {/* Dismiss */}
        <button
          onClick={onClose}
          className="w-full text-sm text-muted hover:text-white transition-colors py-1"
        >
          Maybe Later
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConnectPage() {
  const [games, setGames]           = useState<OpenGame[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [error, setError]           = useState("");
  const [sportFilter, setSportFilter] = useState("");
  const [showModal, setShowModal]   = useState(false);

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
    <>
      {showModal && <AppDownloadModal onClose={() => setShowModal(false)} />}

      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-black text-white mb-2">Connect Games</h1>
          <p className="text-muted">Join open games near you. Split the court cost with other players.</p>
        </div>

        {/* App download banner */}
        <section className="bg-surface border border-border rounded-[28px] px-5 py-4 mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <p className="text-xl md:text-2xl font-black text-white">
              To create a game, download the Dome app
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={GOOGLE_PLAY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 bg-black border border-border rounded-[12px] px-4 py-2.5 text-white min-w-44 hover:border-primary/50 transition-colors"
              >
                <span className="text-2xl">▶</span>
                <span className="leading-tight">
                  <span className="block text-[10px] uppercase tracking-wide text-muted">Get it on</span>
                  <span className="block text-sm font-bold">Google Play</span>
                </span>
              </a>
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 bg-black border border-border rounded-[12px] px-4 py-2.5 text-white min-w-44 hover:border-primary/50 transition-colors"
              >
                <span className="text-2xl"></span>
                <span className="leading-tight">
                  <span className="block text-[10px] uppercase tracking-wide text-muted">Download on the</span>
                  <span className="block text-sm font-bold">App Store</span>
                </span>
              </a>
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
              const emoji  = getSportEmoji(game.sport);
              const filled = game._count.participants;
              const total  = game.playersNeeded;
              const city   = game.facility.address?.city;
              const gameDate = new Date(game.gameDate + "T00:00:00").toLocaleDateString("en-CA", {
                weekday: "short", month: "short", day: "numeric",
              });
              const isFull = filled >= total || game.status !== "OPEN";

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
                    <button
                      disabled={isFull}
                      onClick={() => { if (!isFull) setShowModal(true); }}
                      className={`text-xs font-bold px-4 py-2 rounded-dome transition-colors ${
                        isFull
                          ? "bg-surface-2 text-muted cursor-not-allowed opacity-60"
                          : "bg-primary hover:bg-primary-hover text-white"
                      }`}
                    >
                      {filled >= total ? "Full" : "Join Game"}
                    </button>
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
