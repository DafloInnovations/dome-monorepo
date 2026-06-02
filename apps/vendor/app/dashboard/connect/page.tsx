"use client";

import { useEffect, useState } from "react";
import Header from "../../../components/layout/Header";
import StatusBadge from "../../../components/ui/StatusBadge";
import DataTable from "../../../components/ui/DataTable";
import { api, type OpenGame } from "../../../lib/api";

const SPORT_EMOJI: Record<string, string> = {
  SOCCER: "⚽", BASKETBALL: "🏀", TENNIS: "🎾", BADMINTON: "🏸",
  VOLLEYBALL: "🏐", HOCKEY: "🏒", SQUASH: "🎯", PICKLEBALL: "🏓",
  BASEBALL: "⚾", CRICKET: "🏏",
};

const SKILL_LABEL: Record<string, string> = {
  BEGINNER: "Beginner", INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced", ANY: "Any level",
};

export default function ConnectGamesPage() {
  const [games, setGames] = useState<OpenGame[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    api.vendor.connectGames()
      .then((r) => setGames(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setIsLoading(false));
  }, []);

  const visible = statusFilter === "ALL"
    ? games
    : games.filter((g) => g.status.toUpperCase() === statusFilter);

  const statuses = Array.from(new Set(games.map((g) => g.status.toUpperCase())));

  return (
    <>
      <Header title="Connect Games" />
      <main className="flex-1 p-6 space-y-4 overflow-auto">

        {/* Summary cards */}
        {!isLoading && games.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-2">
            <div className="bg-surface border border-border rounded-dome px-4 py-3">
              <p className="text-xs text-muted mb-1">Total Games</p>
              <p className="text-2xl font-bold text-white">{games.length}</p>
            </div>
            <div className="bg-surface border border-border rounded-dome px-4 py-3">
              <p className="text-xs text-muted mb-1">Open Games</p>
              <p className="text-2xl font-bold text-primary">
                {games.filter((g) => g.status.toUpperCase() === "OPEN").length}
              </p>
            </div>
            <div className="bg-surface border border-border rounded-dome px-4 py-3">
              <p className="text-xs text-muted mb-1">Total Players</p>
              <p className="text-2xl font-bold text-white">
                {games.reduce((s, g) => s + g._count.participants, 0)}
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-2">
          {["ALL", ...statuses].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                statusFilter === s
                  ? "bg-primary text-white"
                  : "bg-surface border border-border text-muted hover:text-white"
              }`}>
              {s}
            </button>
          ))}
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {games.length === 0 && !isLoading ? (
          <div className="text-center py-24 text-muted">
            <p className="text-5xl mb-4">🤝</p>
            <p className="font-semibold text-white text-lg">No Open Games yet</p>
            <p className="text-sm mt-1">
              Open Games are created by players at your facilities. They will appear here once created.
            </p>
          </div>
        ) : (
          <DataTable
            isLoading={isLoading}
            data={visible as unknown as Record<string, unknown>[]}
            emptyMessage="No games match the selected filter"
            columns={[
              {
                key: "sport", header: "Sport",
                render: (r) => {
                  const g = r as unknown as OpenGame;
                  return (
                    <span className="flex items-center gap-2">
                      <span>{SPORT_EMOJI[g.sport.toUpperCase()] ?? "🏟"}</span>
                      <span>{g.sport.charAt(0) + g.sport.slice(1).toLowerCase()}</span>
                    </span>
                  );
                },
              },
              {
                key: "date", header: "Date",
                render: (r) => {
                  const g = r as unknown as OpenGame;
                  return new Date(g.gameDate).toLocaleDateString("en-CA", {
                    weekday: "short", month: "short", day: "numeric",
                  });
                },
              },
              {
                key: "time", header: "Time",
                render: (r) => {
                  const g = r as unknown as OpenGame;
                  return `${g.startTime}–${g.endTime}`;
                },
              },
              {
                key: "facility", header: "Facility",
                render: (r) => { const g = r as unknown as OpenGame; return g.facility.name; },
              },
              {
                key: "host", header: "Host",
                render: (r) => {
                  const g = r as unknown as OpenGame;
                  return `${g.host.firstName} ${g.host.lastName}`;
                },
              },
              {
                key: "players", header: "Players",
                render: (r) => {
                  const g = r as unknown as OpenGame;
                  const filled = g._count.participants;
                  const needed = g.playersNeeded;
                  return (
                    <span className={filled >= needed ? "text-green-400" : "text-yellow-400"}>
                      {filled} / {needed}
                    </span>
                  );
                },
              },
              {
                key: "skill", header: "Skill",
                render: (r) => {
                  const g = r as unknown as OpenGame;
                  return <span className="text-muted text-xs">{SKILL_LABEL[g.skillLevel.toUpperCase()] ?? g.skillLevel}</span>;
                },
              },
              {
                key: "status", header: "Status",
                render: (r) => {
                  const g = r as unknown as OpenGame;
                  return <StatusBadge status={g.status.toUpperCase()} />;
                },
              },
            ]}
          />
        )}
      </main>
    </>
  );
}
