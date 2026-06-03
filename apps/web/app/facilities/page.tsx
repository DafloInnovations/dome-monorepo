"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import FacilityCard from "../../components/ui/FacilityCard";
import SportPill from "../../components/ui/SportPill";
import { API_URL, type Facility } from "../../lib/api";
import { SPORTS, CITIES } from "../../lib/cities";

function buildQuery(params: Record<string, string | number | undefined>): string {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "" && v !== 0)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  return qs ? `?${qs}` : "";
}

export default function FacilitiesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Filter state — seeded from URL
  const [sport, setSport]       = useState(searchParams.get("sport") ?? "");
  const [city, setCity]         = useState(searchParams.get("city") ?? "");
  const [query, setQuery]       = useState(searchParams.get("q") ?? "");

  const cityObj = CITIES.find((c) => c.name.toLowerCase() === city.toLowerCase());

  const fetchFacilities = useCallback(() => {
    setIsLoading(true);
    setError("");
    const q = buildQuery({
      sport:  sport || undefined,
      lat:    cityObj?.lat,
      lng:    cityObj?.lng,
      radius: cityObj ? 30 : undefined,
      limit:  48,
    });
    fetch(`${API_URL}/facilities${q}`)
      .then((r) => r.json())
      .then((json: { data?: Facility[] }) => setFacilities(json.data ?? []))
      .catch(() => setError("Failed to load facilities"))
      .finally(() => setIsLoading(false));
  }, [sport, cityObj]);

  useEffect(() => { fetchFacilities(); }, [fetchFacilities]);

  // Sync filters to URL
  useEffect(() => {
    const p = new URLSearchParams();
    if (sport) p.set("sport", sport);
    if (city)  p.set("city", city);
    if (query) p.set("q", query);
    router.replace(`/facilities${p.toString() ? `?${p}` : ""}`, { scroll: false });
  }, [sport, city, query, router]);

  const sportLabel = SPORTS.find((s) => s.slug === sport)?.label ?? "";
  const titleStr   = [sportLabel, city].filter(Boolean).join(" in ");

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = facilities.filter((facility) => {
    if (!normalizedQuery) return true;
    const haystack = [
      facility.name,
      facility.description,
      facility.sport,
      facility.surface,
      facility.address?.street,
      facility.address?.city,
      facility.address?.province,
      facility.address?.postalCode,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-black text-white">
          {titleStr ? `Book ${titleStr}` : "Find a Facility"}
        </h1>
        <p className="text-muted text-sm mt-1">
          {isLoading ? "Searching…" : `${filtered.length} facilit${filtered.length !== 1 ? "ies" : "y"} found`}
          {city ? ` near ${city}` : ""}
        </p>
      </div>

      <div className="flex gap-6">
        {/* ── Sidebar filters (desktop) ─────────────────────────────── */}
        <aside className="hidden lg:block w-56 shrink-0 space-y-6">
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Search</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">⌕</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, sport, city"
                className="w-full bg-surface border border-border rounded-dome pl-9 pr-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">City</p>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full bg-surface border border-border rounded-dome px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
            >
              <option value="">All Cities</option>
              {CITIES.map((c) => (
                <option key={c.name} value={c.name}>{c.name}, {c.province}</option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Sport</p>
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => setSport("")}
                className={`text-left text-sm px-3 py-1.5 rounded-dome transition-colors ${
                  !sport ? "bg-primary text-white" : "text-muted hover:text-white"
                }`}
              >
                All Sports
              </button>
              {SPORTS.map((s) => (
                <button
                  key={s.slug}
                  onClick={() => setSport(s.slug)}
                  className={`text-left text-sm px-3 py-1.5 rounded-dome transition-colors flex items-center gap-2 ${
                    sport === s.slug ? "bg-primary text-white" : "text-muted hover:text-white"
                  }`}
                >
                  <span>{s.emoji}</span> {s.label}
                </button>
              ))}
            </div>
          </div>

        </aside>

        {/* ── Main content ──────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <div className="lg:hidden mb-4">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">⌕</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, sport, or city"
                className="w-full bg-surface border border-border rounded-dome pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-muted focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Mobile filter bar */}
          <div className="lg:hidden flex items-center gap-2 mb-4 overflow-x-auto pb-2">
            <button
              onClick={() => setFiltersOpen((v) => !v)}
              className="flex items-center gap-2 bg-surface border border-border rounded-dome px-4 py-2 text-sm text-white shrink-0"
            >
              ⚙️ Filters
            </button>
            <SportPill sport="All" emoji="🏟️" active={!sport} onClick={() => setSport("")} />
            {SPORTS.map((s) => (
              <SportPill key={s.slug} sport={s.label} emoji={s.emoji}
                active={sport === s.slug} onClick={() => setSport(s.slug)} />
            ))}
          </div>

          {/* Mobile filter drawer */}
          {filtersOpen && (
            <div className="lg:hidden bg-surface border border-border rounded-dome p-4 mb-4 space-y-4">
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">City</p>
                <select
                  value={city} onChange={(e) => setCity(e.target.value)}
                  className="w-full bg-black border border-border rounded-dome px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                >
                  <option value="">All Cities</option>
                  {CITIES.map((c) => (
                    <option key={c.name} value={c.name}>{c.name}, {c.province}</option>
                  ))}
                </select>
              </div>
              <button onClick={() => setFiltersOpen(false)}
                className="w-full bg-primary text-white text-sm font-bold py-2 rounded-dome">
                Apply
              </button>
            </div>
          )}

          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-surface border border-border rounded-dome h-64 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-24">
              <p className="text-5xl mb-4">🏟️</p>
              <p className="text-xl font-bold text-white mb-2">
                No facilities found{city ? ` in ${city}` : ""}
              </p>
              <p className="text-muted text-sm mb-6">
                Try a different city, sport, or search term, or{" "}
                <button onClick={() => { setSport(""); setCity(""); setQuery(""); }} className="text-primary hover:underline">
                  clear all filters
                </button>.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((f) => (
                <FacilityCard key={f.id} facility={f} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
