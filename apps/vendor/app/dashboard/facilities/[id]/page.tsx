"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Header from "../../../../components/layout/Header";
import { apiFetch } from "../../../../lib/api";

interface FacilityDetail {
  id: string;
  name: string;
  sport: string;
  surface: string;
  description: string;
  isActive: boolean;
  capacity: number;
  courts: { id: string; name: string; isActive: boolean }[];
  address: { street: string; city: string; province: string; postalCode: string } | null;
  operatingHours: { day: number; openTime: string; closeTime: string; isClosed: boolean }[];
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const inputCls =
  "w-full bg-black border border-border rounded-dome px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-primary transition-colors";

export default function FacilityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [facility, setFacility] = useState<FacilityDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", description: "", capacity: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Add court state
  const [showAddCourt, setShowAddCourt] = useState(false);
  const [courtName, setCourtName] = useState("");
  const [isAddingCourt, setIsAddingCourt] = useState(false);
  const [courtError, setCourtError] = useState("");

  // Policy state
  const [policyHours, setPolicyHours] = useState(24);
  const [savingPolicy, setSavingPolicy] = useState(false);

  useEffect(() => {
    apiFetch<{ data: FacilityDetail }>(`/facilities/${id}`)
      .then((r) => {
        setFacility(r.data);
        setEditForm({ name: r.data.name, description: r.data.description, capacity: r.data.capacity });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Not found"))
      .finally(() => setIsLoading(false));
  }, [id]);

  async function toggleActive() {
    if (!facility) return;
    const next = !facility.isActive;
    await apiFetch(`/vendor/facilities/${id}`, {
      method: "PUT",
      body: JSON.stringify({ isActive: next }),
    });
    setFacility((f) => f ? { ...f, isActive: next } : f);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSaveError("");
    setIsSaving(true);
    try {
      const updated = await apiFetch<{ data: FacilityDetail }>(`/vendor/facilities/${id}`, {
        method: "PUT",
        body: JSON.stringify(editForm),
      });
      setFacility(updated.data);
      setEditMode(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  }

  async function addCourt(e: React.FormEvent) {
    e.preventDefault();
    if (!courtName.trim()) return;
    setCourtError("");
    setIsAddingCourt(true);
    try {
      const res = await apiFetch<{ data: { id: string; name: string; isActive: boolean } }>(
        `/vendor/facilities/${id}/courts`,
        { method: "POST", body: JSON.stringify({ name: courtName.trim() }) }
      );
      setFacility((f) => f ? { ...f, courts: [...f.courts, res.data] } : f);
      setCourtName("");
      setShowAddCourt(false);
    } catch (err) {
      setCourtError(err instanceof Error ? err.message : "Failed to add court");
    } finally {
      setIsAddingCourt(false);
    }
  }

  async function savePolicy() {
    setSavingPolicy(true);
    await apiFetch(`/vendor/facilities/${id}`, {
      method: "PUT",
      body: JSON.stringify({ cancellationHours: policyHours }),
    }).catch(() => null);
    setSavingPolicy(false);
  }

  if (isLoading) return (
    <>
      <Header title="Facility" />
      <main className="flex-1 p-6">
        <div className="h-40 bg-surface border border-border rounded-dome animate-pulse" />
      </main>
    </>
  );

  if (error || !facility) return (
    <>
      <Header title="Facility" />
      <main className="flex-1 p-6">
        <p className="text-red-400">{error || "Facility not found"}</p>
      </main>
    </>
  );

  return (
    <>
      <Header title={facility.name} />
      <main className="flex-1 p-6 space-y-6 overflow-auto">

        {/* Facility info */}
        <div className="bg-surface border border-border rounded-dome p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-white">{facility.name}</h2>
              <p className="text-sm text-muted mt-1">
                {facility.sport} · {facility.surface} · Capacity: {facility.capacity}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleActive}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                  facility.isActive
                    ? "bg-green-900/40 text-green-400 hover:bg-green-900/60"
                    : "bg-surface-2 text-muted hover:text-white"
                }`}
              >
                {facility.isActive ? "Active" : "Inactive"}
              </button>
              <button
                onClick={() => { setEditMode((v) => !v); setSaveError(""); }}
                className="text-xs text-primary hover:underline font-medium"
              >
                {editMode ? "Cancel" : "Edit"}
              </button>
            </div>
          </div>

          {editMode ? (
            <form onSubmit={saveEdit} className="space-y-3 mt-2">
              <div>
                <label className="block text-xs text-muted mb-1">Name</label>
                <input type="text" required value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Description</label>
                <textarea value={editForm.description}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3} className={inputCls + " resize-none"} />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Capacity</label>
                <input type="number" min={1} value={editForm.capacity}
                  onChange={(e) => setEditForm((f) => ({ ...f, capacity: Number(e.target.value) }))}
                  className={inputCls} style={{ maxWidth: 100 }} />
              </div>
              {saveError && <p className="text-red-400 text-xs">{saveError}</p>}
              <button type="submit" disabled={isSaving}
                className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-dome transition-colors">
                {isSaving ? "Saving…" : "Save Changes"}
              </button>
            </form>
          ) : (
            <>
              {facility.address && (
                <p className="text-sm text-muted">
                  {facility.address.street}, {facility.address.city}, {facility.address.province}{" "}
                  {facility.address.postalCode}
                </p>
              )}
              {facility.description && (
                <p className="text-sm text-muted mt-2">{facility.description}</p>
              )}
            </>
          )}
        </div>

        {/* Courts */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">Courts</h2>
            <button
              onClick={() => { setShowAddCourt((v) => !v); setCourtError(""); setCourtName(""); }}
              className="text-xs text-primary hover:underline font-medium"
            >
              {showAddCourt ? "Cancel" : "+ Add Court"}
            </button>
          </div>

          {showAddCourt && (
            <form onSubmit={addCourt} className="mb-4 flex items-center gap-3">
              <input
                type="text"
                required
                placeholder="Court name (e.g. Court 1)"
                value={courtName}
                onChange={(e) => setCourtName(e.target.value)}
                className="flex-1 bg-black border border-border rounded-dome px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-primary"
              />
              <button type="submit" disabled={isAddingCourt}
                className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-dome transition-colors whitespace-nowrap">
                {isAddingCourt ? "Adding…" : "Add"}
              </button>
              {courtError && <p className="text-red-400 text-xs">{courtError}</p>}
            </form>
          )}

          {facility.courts.length === 0 ? (
            <p className="text-sm text-muted">No courts yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {facility.courts.map((court) => (
                <div
                  key={court.id}
                  className="bg-surface border border-border rounded-dome p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-white">{court.name}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {court.isActive ? "Active" : "Inactive"}
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/courts/${court.id}/slots`}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    Manage Slots →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Operating hours */}
        {facility.operatingHours.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
              Operating Hours
            </h2>
            <div className="bg-surface border border-border rounded-dome overflow-hidden">
              {facility.operatingHours.map((oh) => (
                <div
                  key={oh.day}
                  className="flex items-center justify-between px-4 py-2.5 border-b border-border last:border-0"
                >
                  <span className="text-sm text-white w-10">{DAYS[oh.day]}</span>
                  {oh.isClosed ? (
                    <span className="text-sm text-muted">Closed</span>
                  ) : (
                    <span className="text-sm text-muted">{oh.openTime} – {oh.closeTime}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cancellation policy */}
        <div className="bg-surface border border-border rounded-dome p-6">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-4">
            Cancellation Policy
          </h2>
          <div className="flex items-center gap-6">
            <div>
              <label className="block text-xs text-muted mb-1">Free cancel window</label>
              <div className="flex gap-2">
                {[12, 24, 48].map((h) => (
                  <button
                    key={h}
                    onClick={() => setPolicyHours(h)}
                    className={`px-4 py-2 rounded-dome text-sm font-medium transition-colors ${
                      policyHours === h
                        ? "bg-primary text-white"
                        : "bg-surface-2 text-muted hover:text-white"
                    }`}
                  >
                    {h}h
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={savePolicy}
              disabled={savingPolicy}
              className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-dome transition-colors self-end"
            >
              {savingPolicy ? "Saving…" : "Save"}
            </button>
          </div>
          <p className="text-xs text-muted mt-3">
            Players who cancel more than {policyHours}h before their slot get a full refund.
            Late cancellations receive Dome Credits.
          </p>
        </div>
      </main>
    </>
  );
}
