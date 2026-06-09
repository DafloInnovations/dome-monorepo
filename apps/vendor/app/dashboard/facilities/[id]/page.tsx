"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Header from "../../../../components/layout/Header";
import { apiFetch } from "../../../../lib/api";

interface Court {
  id: string;
  name: string;
  isActive: boolean;
  isShared: boolean;
  sports: string[];
  primarySport: string | null;
}

interface FacilityDetail {
  id: string;
  name: string;
  sport: string;
  surface: string;
  description: string;
  isActive: boolean;
  capacity: number;
  images: string[];
  courts: Court[];
  address: { street: string; city: string; province: string; postalCode: string } | null;
  operatingHours: { day: number; openTime: string; closeTime: string; isClosed: boolean }[];
  cancellationWindowHours: number;
}

const ALL_SPORTS = [
  "BADMINTON", "PICKLEBALL", "TENNIS", "SQUASH",
  "SOCCER", "BASKETBALL", "VOLLEYBALL", "HOCKEY", "BASEBALL", "CRICKET",
] as const;

const SPORT_EMOJI: Record<string, string> = {
  BADMINTON: "🏸", PICKLEBALL: "🏓", TENNIS: "🎾", SQUASH: "🎾",
  SOCCER: "⚽", BASKETBALL: "🏀", VOLLEYBALL: "🏐", HOCKEY: "🏒",
  BASEBALL: "⚾", CRICKET: "🏏",
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

const inputCls =
  "w-full bg-black border border-border rounded-dome px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-primary transition-colors";

export default function FacilityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [facility, setFacility] = useState<FacilityDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ description: "", capacity: 0, images: [] as string[] });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [photoError, setPhotoError] = useState("");

  // Add court state
  const [showAddCourt, setShowAddCourt] = useState(false);
  const [courtName, setCourtName] = useState("");
  const [isAddingCourt, setIsAddingCourt] = useState(false);
  const [courtError, setCourtError] = useState("");

  // Policy state
  const [policyHours, setPolicyHours] = useState(24);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [policySaved, setPolicySaved] = useState(false);
  const [policyError, setPolicyError] = useState("");

  // Shared court editor state (per courtId)
  const [sharedEditing, setSharedEditing] = useState<string | null>(null);
  const [sharedForm, setSharedForm] = useState<{
    isShared: boolean;
    sports: string[];
    sportPricing: { sport: string; priceCAD: string }[];
  }>({ isShared: false, sports: [], sportPricing: [] });
  const [savingShared, setSavingShared] = useState(false);
  const [sharedError, setSharedError] = useState("");

  useEffect(() => {
    apiFetch<{ data: FacilityDetail }>(`/vendor/facilities/${id}`)
      .then((r) => {
        setFacility({
          ...r.data,
          images: r.data.images ?? [],
          courts: (r.data.courts ?? []).map((c) => ({
            ...c,
            isShared: (c as Court).isShared ?? false,
            sports: (c as Court).sports ?? [],
            primarySport: (c as Court).primarySport ?? null,
          })),
          operatingHours: r.data.operatingHours ?? [],
          cancellationWindowHours: r.data.cancellationWindowHours ?? 24,
        });
        setEditForm({
          description: r.data.description,
          capacity: r.data.capacity,
          images: r.data.images ?? [],
        });
        setPolicyHours(r.data.cancellationWindowHours ?? 24);
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

  function readPhoto(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Failed to read photo"));
      reader.readAsDataURL(file);
    });
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    setPhotoError("");
    if (files.length === 0) return;

    const remaining = MAX_PHOTOS - editForm.images.length;
    if (remaining <= 0) {
      setPhotoError(`You can upload up to ${MAX_PHOTOS} photos.`);
      return;
    }

    const accepted = files.slice(0, remaining);
    const invalid = accepted.find((file) => !file.type.startsWith("image/") || file.size > MAX_PHOTO_BYTES);
    if (invalid) {
      setPhotoError("Photos must be image files under 2 MB each.");
      return;
    }
    if (files.length > remaining) {
      setPhotoError(`Only ${remaining} more photo${remaining === 1 ? "" : "s"} can be added.`);
    }

    try {
      const nextPhotos = await Promise.all(accepted.map(readPhoto));
      setEditForm((current) => ({
        ...current,
        images: [...current.images, ...nextPhotos].slice(0, MAX_PHOTOS),
      }));
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Failed to upload photos");
    }
  }

  function removePhoto(index: number) {
    setPhotoError("");
    setEditForm((current) => ({
      ...current,
      images: current.images.filter((_, i) => i !== index),
    }));
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
      setFacility({
        ...updated.data,
        images: updated.data.images ?? [],
        courts: updated.data.courts ?? [],
        operatingHours: updated.data.operatingHours ?? [],
      });
      setEditForm({
        description: updated.data.description,
        capacity: updated.data.capacity,
        images: updated.data.images ?? [],
      });
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
      const res = await apiFetch<{ data: Court }>(
        `/vendor/facilities/${id}/courts`,
        { method: "POST", body: JSON.stringify({ name: courtName.trim() }) }
      );
      const newCourt: Court = { ...res.data, isShared: res.data.isShared ?? false, sports: res.data.sports ?? [], primarySport: res.data.primarySport ?? null };
      setFacility((f) => f ? { ...f, courts: [...f.courts, newCourt] } : f);
      setCourtName("");
      setShowAddCourt(false);
    } catch (err) {
      setCourtError(err instanceof Error ? err.message : "Failed to add court");
    } finally {
      setIsAddingCourt(false);
    }
  }

  function openSharedEditor(court: Court) {
    setSharedEditing(court.id);
    setSharedError("");
    setSharedForm({
      isShared: court.isShared,
      sports: court.sports.length > 0 ? court.sports : [court.name.toUpperCase().replace(/\s/g, "_")],
      sportPricing: court.sports.map((s) => ({ sport: s, priceCAD: "25" })),
    });
  }

  async function saveSharedCourt() {
    if (!sharedEditing) return;
    setSavingShared(true);
    setSharedError("");
    try {
      const payload = {
        isShared: sharedForm.isShared,
        sports: sharedForm.sports,
        sportPricing: sharedForm.sportPricing
          .filter((p) => p.priceCAD && Number(p.priceCAD) > 0)
          .map((p) => ({ sport: p.sport, priceCAD: Number(p.priceCAD) })),
      };
      await apiFetch(`/vendor/courts/${sharedEditing}/shared`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setFacility((f) => f ? {
        ...f,
        courts: f.courts.map((c) =>
          c.id === sharedEditing
            ? { ...c, isShared: sharedForm.isShared, sports: sharedForm.sports }
            : c
        ),
      } : f);
      setSharedEditing(null);
    } catch (err) {
      setSharedError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingShared(false);
    }
  }

  async function savePolicy() {
    setSavingPolicy(true);
    setPolicySaved(false);
    setPolicyError("");
    try {
      await apiFetch(`/vendor/facilities/${id}`, {
        method: "PUT",
        body: JSON.stringify({ cancellationWindowHours: policyHours }),
      });
      setFacility((f) => f ? { ...f, cancellationWindowHours: policyHours } : f);
      setPolicySaved(true);
      setTimeout(() => setPolicySaved(false), 3000);
    } catch (err) {
      setPolicyError(err instanceof Error ? err.message : "Failed to save policy");
    } finally {
      setSavingPolicy(false);
    }
  }

  if (isLoading) return (
    <>
      <Header title="Sports" />
      <main className="flex-1 p-6">
        <div className="h-40 bg-surface border border-border rounded-dome animate-pulse" />
      </main>
    </>
  );

  if (error || !facility) return (
    <>
      <Header title="Sports" />
      <main className="flex-1 p-6">
        <p className="text-red-400">{error || "Sports not found"}</p>
      </main>
    </>
  );

  return (
    <>
      <Header title={facility.name} />
      <main className="flex-1 p-6 space-y-6 overflow-auto">

        {/* Sports info */}
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
                <div className="w-full bg-black border border-border rounded-dome px-3 py-2 text-sm text-white">
                  {facility.name}
                </div>
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
              <div>
                <label className="block text-xs text-muted mb-1">
                  Facility Photos ({editForm.images.length}/{MAX_PHOTOS})
                </label>
                <div className="space-y-3">
                  <label className={`inline-flex items-center justify-center bg-surface-2 border border-border rounded-dome px-4 py-2 text-sm font-semibold text-white transition-colors ${
                    editForm.images.length >= MAX_PHOTOS ? "opacity-50 cursor-not-allowed" : "hover:border-primary cursor-pointer"
                  }`}>
                    Upload Photos
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={editForm.images.length >= MAX_PHOTOS}
                      onChange={handlePhotoUpload}
                      className="sr-only"
                    />
                  </label>
                  <p className="text-xs text-muted">Add up to 5 photos. Each photo must be under 2 MB.</p>
                  {photoError && <p className="text-xs text-red-400">{photoError}</p>}
                  {editForm.images.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {editForm.images.map((photo, index) => (
                        <div key={photo.slice(0, 40) + index} className="relative aspect-square overflow-hidden rounded-dome border border-border bg-black">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photo} alt={`Facility photo ${index + 1}`} className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removePhoto(index)}
                            className="absolute right-1.5 top-1.5 h-7 w-7 rounded-full bg-black/80 border border-border text-white text-sm hover:border-primary transition-colors"
                            aria-label={`Remove photo ${index + 1}`}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
            <div className="space-y-3">
              {facility.courts.map((court) => (
                <div key={court.id} className="bg-surface border border-border rounded-dome p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium text-white flex items-center gap-2">
                        {court.name}
                        {court.isShared && (
                          <span className="text-xs bg-blue-900/40 text-blue-400 border border-blue-800 px-2 py-0.5 rounded-full">
                            🔄 Shared Court
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        {court.isActive ? "Active" : "Inactive"}
                        {court.isShared && court.sports.length > 0 && (
                          <span className="ml-2">
                            {court.sports.map((s) => `${SPORT_EMOJI[s] ?? ""} ${s.charAt(0) + s.slice(1).toLowerCase()}`).join(" · ")}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => openSharedEditor(court)}
                        className="text-xs text-muted hover:text-white border border-border hover:border-primary px-2.5 py-1 rounded-dome transition-colors"
                      >
                        🔄 Shared Court
                      </button>
                      <Link
                        href={`/dashboard/courts/${court.id}/slots`}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        Manage Slots →
                      </Link>
                      <Link
                        href={`/dashboard/courts/${court.id}`}
                        className="text-xs text-muted hover:text-white hover:underline font-medium"
                      >
                        ⚙ Booking Rules
                      </Link>
                    </div>
                  </div>

                  {/* Shared court inline editor */}
                  {sharedEditing === court.id && (
                    <div className="mt-3 pt-3 border-t border-border space-y-4">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setSharedForm((f) => ({ ...f, isShared: !f.isShared }))}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            sharedForm.isShared ? "bg-primary" : "bg-gray-700"
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            sharedForm.isShared ? "translate-x-6" : "translate-x-1"
                          }`} />
                        </button>
                        <span className="text-sm text-white font-medium">
                          {sharedForm.isShared ? "Shared Court (ON)" : "Single Sport Court"}
                        </span>
                      </div>

                      {sharedForm.isShared && (
                        <>
                          <div>
                            <p className="text-xs text-muted mb-2">Sports supported:</p>
                            <div className="flex flex-wrap gap-2">
                              {ALL_SPORTS.map((sport) => {
                                const on = sharedForm.sports.includes(sport);
                                return (
                                  <button
                                    key={sport}
                                    type="button"
                                    onClick={() => {
                                      setSharedForm((f) => {
                                        const next = on
                                          ? f.sports.filter((s) => s !== sport)
                                          : [...f.sports, sport];
                                        // Sync pricing rows
                                        const pricingNext = next.map((s) => ({
                                          sport: s,
                                          priceCAD: f.sportPricing.find((p) => p.sport === s)?.priceCAD ?? "25",
                                        }));
                                        return { ...f, sports: next, sportPricing: pricingNext };
                                      });
                                    }}
                                    className={`px-3 py-1 text-xs font-medium rounded-dome border transition-colors ${
                                      on
                                        ? "bg-primary border-primary text-white"
                                        : "bg-surface border-border text-muted hover:text-white"
                                    }`}
                                  >
                                    {SPORT_EMOJI[sport] ?? ""} {sport.charAt(0) + sport.slice(1).toLowerCase()}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {sharedForm.sports.length > 0 && (
                            <div>
                              <p className="text-xs text-muted mb-2">Pricing per sport (C$/slot):</p>
                              <div className="space-y-2">
                                {sharedForm.sportPricing.map((row) => (
                                  <div key={row.sport} className="flex items-center gap-3">
                                    <span className="text-sm text-white w-28">
                                      {SPORT_EMOJI[row.sport] ?? ""} {row.sport.charAt(0) + row.sport.slice(1).toLowerCase()}
                                    </span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-muted text-sm">C$</span>
                                      <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={row.priceCAD}
                                        onChange={(e) => setSharedForm((f) => ({
                                          ...f,
                                          sportPricing: f.sportPricing.map((p) =>
                                            p.sport === row.sport ? { ...p, priceCAD: e.target.value } : p
                                          ),
                                        }))}
                                        className="w-20 bg-black border border-border rounded-dome px-2 py-1 text-sm text-white focus:outline-none focus:border-primary"
                                      />
                                      <span className="text-muted text-xs">/hr</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <p className="text-xs text-muted">
                            ℹ️ Booking one sport will automatically block the court for other sports at the same time.
                          </p>
                        </>
                      )}

                      {sharedError && <p className="text-red-400 text-xs">{sharedError}</p>}
                      <div className="flex gap-2">
                        <button
                          onClick={saveSharedCourt}
                          disabled={savingShared}
                          className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-dome transition-colors"
                        >
                          {savingShared ? "Saving…" : "Save Changes"}
                        </button>
                        <button
                          onClick={() => setSharedEditing(null)}
                          className="text-sm text-muted hover:text-white px-3 py-2 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
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
          {policySaved && (
            <p className="text-xs text-green-400 mt-2">✓ Policy saved</p>
          )}
          {policyError && (
            <p className="text-xs text-red-500 mt-2">{policyError}</p>
          )}
        </div>
      </main>
    </>
  );
}
