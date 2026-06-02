"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "../../../components/layout/Header";
import { api, apiFetch, type Facility } from "../../../lib/api";

const SPORT_EMOJI: Record<string, string> = {
  SOCCER: "⚽", BASKETBALL: "🏀", TENNIS: "🎾", BADMINTON: "🏸",
  VOLLEYBALL: "🏐", HOCKEY: "🏒", SQUASH: "🎯", PICKLEBALL: "🏓",
  BASEBALL: "⚾", CRICKET: "🏏",
};

export default function FacilitiesPage() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    api.vendor.facilities()
      .then((r) => setFacilities(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setIsLoading(false));
  }, []);

  async function toggleActive(facility: Facility) {
    setToggling(facility.id);
    try {
      await apiFetch(`/vendor/facilities/${facility.id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: !facility.isActive }),
      });
      setFacilities((prev) =>
        prev.map((f) => f.id === facility.id ? { ...f, isActive: !f.isActive } : f)
      );
    } catch {
      // silent — badge reverts
    } finally {
      setToggling(null);
    }
  }

  return (
    <>
      <Header title="Facilities" />
      <main className="flex-1 p-6">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-muted">{facilities.length} facility/ies</p>
          <Link
            href="/dashboard/facilities/new"
            className="bg-primary hover:bg-primary-hover text-white text-sm font-semibold px-4 py-2 rounded-dome transition-colors"
          >
            + Add Facility
          </Link>
        </div>

        {error && (
          <p className="text-red-400 text-sm mb-4">{error}</p>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="bg-surface border border-border rounded-dome h-40 animate-pulse" />
            ))}
          </div>
        ) : facilities.length === 0 ? (
          <div className="text-center py-20 text-muted">
            <p className="text-5xl mb-4">🏟</p>
            <p className="font-semibold text-white text-lg">No facilities yet</p>
            <p className="text-sm mt-1">Add your first facility to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {facilities.map((facility) => (
              <div
                key={facility.id}
                className="bg-surface border border-border rounded-dome p-5 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{SPORT_EMOJI[facility.sport.toUpperCase()] ?? "🏟"}</span>
                    <div>
                      <h3 className="font-bold text-white">{facility.name}</h3>
                      <p className="text-xs text-muted mt-0.5">
                        {facility.sport.charAt(0) + facility.sport.slice(1).toLowerCase()}
                        {facility.address ? ` · ${facility.address.city}` : ""}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleActive(facility)}
                    disabled={toggling === facility.id}
                    title={facility.isActive ? "Click to deactivate" : "Click to activate"}
                    className="flex items-center gap-1.5 disabled:opacity-60"
                  >
                    <span className={`relative inline-flex w-9 h-5 rounded-full transition-colors ${facility.isActive ? "bg-primary" : "bg-border"}`}>
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${facility.isActive ? "translate-x-4" : ""}`} />
                    </span>
                    <span className={`text-xs font-semibold ${facility.isActive ? "text-green-400" : "text-muted"}`}>
                      {facility.isActive ? "Active" : "Inactive"}
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-4 text-sm text-muted mb-4">
                  <span>{facility.courts.length} court{facility.courts.length !== 1 ? "s" : ""}</span>
                  <span>{facility._count.bookings} bookings</span>
                </div>

                <div className="flex items-center gap-4">
                  <Link
                    href={`/dashboard/facilities/${facility.id}`}
                    className="text-sm text-primary hover:underline font-medium"
                  >
                    Manage Courts →
                  </Link>
                  <Link
                    href={`/dashboard/facilities/${facility.id}`}
                    className="text-sm text-muted hover:text-white transition-colors"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
