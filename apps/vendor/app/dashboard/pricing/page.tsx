"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "../../../components/layout/Header";
import { apiFetch } from "../../../lib/api";

interface Court {
  id: string;
  name: string;
  isActive: boolean;
  dynamicPricingEnabled: boolean;
}

interface Facility {
  id: string;
  name: string;
  sport: string;
  courts: Court[];
}

export default function PricingOverviewPage() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<{ data: Facility[] }>("/vendor/facilities")
      .then((r) => setFacilities(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setIsLoading(false));
  }, []);

  const totalCourts = facilities.reduce((s, f) => s + f.courts.length, 0);
  const dynamicCount = facilities.reduce(
    (s, f) => s + f.courts.filter((c) => c.dynamicPricingEnabled).length,
    0
  );

  if (isLoading) return (
    <>
      <Header title="Pricing" />
      <main className="flex-1 p-6">
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-surface border border-border rounded-dome animate-pulse" />)}</div>
      </main>
    </>
  );

  return (
    <>
      <Header title="Pricing" />
      <main className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto p-6 space-y-6">

          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface border border-border rounded-dome p-4">
              <p className="text-xs text-muted uppercase tracking-widest mb-1">Courts</p>
              <p className="text-2xl font-black text-white">{totalCourts}</p>
            </div>
            <div className="bg-surface border border-border rounded-dome p-4">
              <p className="text-xs text-muted uppercase tracking-widest mb-1">Dynamic Pricing ON</p>
              <p className="text-2xl font-black text-primary">{dynamicCount}</p>
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          {facilities.length === 0 ? (
            <div className="bg-surface border border-border rounded-dome p-8 text-center">
              <p className="text-muted text-sm">No facilities found.</p>
              <Link href="/dashboard/facilities" className="text-primary text-sm hover:underline mt-2 inline-block">
                Create a facility →
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {facilities.map((facility) => (
                <div key={facility.id} className="bg-surface border border-border rounded-dome overflow-hidden">
                  <div className="px-5 py-3 border-b border-border bg-surface-2">
                    <p className="text-sm font-semibold text-white">{facility.name}</p>
                    <p className="text-xs text-muted">{facility.sport}</p>
                  </div>

                  {facility.courts.length === 0 ? (
                    <p className="text-sm text-muted px-5 py-4">No courts yet.</p>
                  ) : (
                    <div className="divide-y divide-border">
                      {facility.courts.map((court) => (
                        <div key={court.id} className="flex items-center justify-between px-5 py-3">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-white">{court.name}</span>
                            {court.dynamicPricingEnabled && (
                              <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-medium">
                                ⚡ Dynamic ON
                              </span>
                            )}
                            {!court.isActive && (
                              <span className="text-xs text-muted border border-border px-2 py-0.5 rounded-full">
                                Inactive
                              </span>
                            )}
                          </div>
                          <Link
                            href={`/dashboard/courts/${court.id}/pricing`}
                            className="text-xs font-semibold text-primary hover:underline"
                          >
                            Manage Pricing →
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
