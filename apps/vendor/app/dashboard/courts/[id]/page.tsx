"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Header from "../../../../components/layout/Header";
import { apiFetch } from "../../../../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CourtDetail {
  id: string;
  name: string;
  facilityId: string;
  minBookingMinutes: number;
  durationStepMinutes: number;
  maxBookingMinutes: number;
  facility: { id: string; name: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function getPreviewDurations(min: number, step: number, max: number): number[] {
  const out: number[] = [];
  let cur = min;
  while (cur <= max) { out.push(cur); cur += step; }
  return out;
}

// ─── Selector card ────────────────────────────────────────────────────────────

function RuleCard({
  selected, title, subtitle, onClick,
}: {
  selected: boolean; title: string; subtitle: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "relative flex-1 rounded-xl border-2 p-4 text-left transition-all",
        selected
          ? "border-primary bg-[#FFF5F7]"
          : "border-border bg-surface hover:border-primary/40",
      ].join(" ")}
    >
      {selected && (
        <span className="absolute right-3 top-3 text-primary text-sm font-bold">✓</span>
      )}
      <p className={`text-sm font-bold ${selected ? "text-primary" : "text-white"}`}>{title}</p>
      <p className="mt-1 text-xs text-muted">{subtitle}</p>
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CourtSettingsPage() {
  const { id: courtId } = useParams<{ id: string }>();

  const [court, setCourt] = useState<CourtDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [minMinutes, setMinMinutes]   = useState(60);
  const [stepMinutes, setStepMinutes] = useState(30);
  const [maxMinutes, setMaxMinutes]   = useState(180);

  useEffect(() => {
    if (!courtId) return;
    apiFetch<{ data: CourtDetail }>(`/vendor/courts/${courtId}`)
      .then((r: { data: CourtDetail }) => {
        setCourt(r.data);
        setMinMinutes(r.data.minBookingMinutes);
        setStepMinutes(r.data.durationStepMinutes);
        setMaxMinutes(r.data.maxBookingMinutes);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load court"))
      .finally(() => setIsLoading(false));
  }, [courtId]);

  const previewDurations = useMemo(
    () => getPreviewDurations(minMinutes, stepMinutes, maxMinutes),
    [minMinutes, stepMinutes, maxMinutes]
  );

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (minMinutes > maxMinutes) {
      setError("Minimum must not exceed maximum"); return;
    }
    setIsSaving(true);
    setError("");
    setSuccess(false);
    try {
      await apiFetch(`/vendor/courts/${courtId}/duration-rules`, {
        method: "PUT",
        body: JSON.stringify({
          minBookingMinutes:   minMinutes,
          durationStepMinutes: stepMinutes,
          maxBookingMinutes:   maxMinutes,
        }),
      });
      setSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  }

  const inputCls = "w-full bg-black border border-border rounded-dome px-3 py-2 text-white text-sm focus:outline-none focus:border-primary";

  return (
    <>
      <Header title={court ? `${court.name} — Settings` : "Court Settings"} />
      <main className="flex-1 p-6 max-w-2xl space-y-6 overflow-auto">

        {/* Breadcrumb */}
        {court && (
          <div className="flex items-center gap-2 text-xs text-muted">
            <Link href="/dashboard/facilities" className="hover:text-white transition-colors">Facilities</Link>
            <span>›</span>
            <Link href={`/dashboard/facilities/${court.facilityId}`} className="hover:text-white transition-colors">{court.facility.name}</Link>
            <span>›</span>
            <span className="text-white">{court.name}</span>
          </div>
        )}

        {/* Quick nav */}
        <div className="flex gap-2 flex-wrap">
          <Link href={`/dashboard/courts/${courtId}/slots`}
            className="px-3 py-1.5 text-xs font-semibold border border-border text-muted hover:text-white hover:border-primary/50 rounded-dome transition-colors">
            📅 Manage Slots
          </Link>
          <Link href={`/dashboard/courts/${courtId}/pricing`}
            className="px-3 py-1.5 text-xs font-semibold border border-border text-muted hover:text-white hover:border-primary/50 rounded-dome transition-colors">
            ⚡ Dynamic Pricing
          </Link>
        </div>

        {isLoading ? (
          <div className="h-64 bg-surface border border-border rounded-dome animate-pulse" />
        ) : (
          <form onSubmit={handleSave} className="space-y-6">

            {/* ── Minimum booking ───────────────────────────────────── */}
            <div className="bg-surface border border-border rounded-dome p-5 space-y-4">
              <div>
                <p className="text-xs font-bold text-muted uppercase tracking-wide mb-0.5">Minimum Booking Duration</p>
                <p className="text-xs text-muted">Shortest booking a player can make</p>
              </div>
              <div className="flex gap-3">
                <RuleCard
                  selected={minMinutes === 30}
                  title="30 min"
                  subtitle="Half-hour minimum"
                  onClick={() => { setMinMinutes(30); setStepMinutes(30); }}
                />
                <RuleCard
                  selected={minMinutes === 60}
                  title="60 min"
                  subtitle="1-hour minimum"
                  onClick={() => setMinMinutes(60)}
                />
              </div>
            </div>

            {/* ── Duration increments ───────────────────────────────── */}
            <div className="bg-surface border border-border rounded-dome p-5 space-y-4">
              <div>
                <p className="text-xs font-bold text-muted uppercase tracking-wide mb-0.5">Duration Increments</p>
                <p className="text-xs text-muted">Players can extend their booking by this amount</p>
              </div>
              <div className="flex gap-3">
                <RuleCard
                  selected={stepMinutes === 30}
                  title="30 min steps"
                  subtitle="30m, 1h, 1.5h, 2h…"
                  onClick={() => setStepMinutes(30)}
                />
                {minMinutes >= 60 && (
                  <RuleCard
                    selected={stepMinutes === 60}
                    title="60 min steps"
                    subtitle="1h, 2h, 3h only"
                    onClick={() => setStepMinutes(60)}
                  />
                )}
              </div>
              {minMinutes === 30 && stepMinutes === 60 && (
                <p className="text-xs text-amber-400">Step cannot exceed minimum — resetting to 30 min</p>
              )}
            </div>

            {/* ── Maximum booking ───────────────────────────────────── */}
            <div className="bg-surface border border-border rounded-dome p-5 space-y-4">
              <div>
                <p className="text-xs font-bold text-muted uppercase tracking-wide mb-0.5">Maximum Booking Duration</p>
                <p className="text-xs text-muted">Longest single booking allowed</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {[60, 90, 120, 150, 180].filter((v) => v >= minMinutes).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setMaxMinutes(v)}
                    className={[
                      "px-4 py-2 rounded-dome text-sm font-semibold border transition-colors",
                      maxMinutes === v
                        ? "bg-primary border-primary text-white"
                        : "border-border text-muted hover:text-white hover:border-primary/50",
                    ].join(" ")}
                  >
                    {fmtDuration(v)}
                  </button>
                ))}
              </div>
              {minMinutes > maxMinutes && (
                <p className="text-xs text-red-400">Maximum must be at least {fmtDuration(minMinutes)}</p>
              )}
            </div>

            {/* ── Live preview ──────────────────────────────────────── */}
            <div className="bg-black/40 border border-border rounded-xl p-5 space-y-3">
              <p className="text-xs font-bold text-muted uppercase tracking-wide">Preview — Players will see:</p>
              <div className="flex gap-2 flex-wrap">
                {previewDurations.map((d) => (
                  <span key={d}
                    className="px-3 py-1.5 bg-surface border border-border rounded-dome text-sm font-semibold text-white">
                    {fmtDuration(d)}
                  </span>
                ))}
              </div>
              <div className="text-xs text-muted space-y-0.5 pt-1 border-t border-border/50">
                <p>✓ Min: {fmtDuration(minMinutes)}</p>
                <p>✓ Steps: {fmtDuration(stepMinutes)}</p>
                <p>✓ Max: {fmtDuration(maxMinutes)}</p>
                <p className="text-muted/70">{previewDurations.length} duration option{previewDurations.length !== 1 ? "s" : ""}</p>
              </div>
            </div>

            {error   && <p className="text-red-400 text-sm">{error}</p>}
            {success && <p className="text-green-400 text-sm">✓ Booking rules saved</p>}

            <button
              type="submit"
              disabled={isSaving || minMinutes > maxMinutes}
              className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold py-3 rounded-dome transition-colors"
            >
              {isSaving ? "Saving…" : "Save Booking Rules"}
            </button>
          </form>
        )}
      </main>
    </>
  );
}
