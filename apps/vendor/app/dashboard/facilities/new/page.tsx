"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../../../../components/layout/Header";
import { apiFetch } from "../../../../lib/api";

const SPORTS = ["soccer","basketball","tennis","badminton","volleyball","hockey","squash","pickleball","baseball","cricket"] as const;
const SURFACES = ["turf","hardwood","concrete","clay","ice","grass","rubberized"] as const;
const PROVINCES = ["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"] as const;
const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"] as const;
const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

interface HoursRow {
  day: number;
  isClosed: boolean;
  openTime: string;
  closeTime: string;
}

const defaultHours = (): HoursRow[] =>
  DAYS.map((_, i) => ({
    day: i,
    isClosed: i === 0 || i === 6,
    openTime: "08:00",
    closeTime: "22:00",
  }));

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full bg-black border border-border rounded-dome px-3 py-2.5 text-sm text-white placeholder:text-muted focus:outline-none focus:border-primary transition-colors";
const selectCls = inputCls + " cursor-pointer";

interface VendorProfile {
  businessName: string;
}

export default function NewFacilityPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [facilityName, setFacilityName] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);

  const [form, setForm] = useState({
    description: "",
    sport: "soccer" as (typeof SPORTS)[number],
    surface: "turf" as (typeof SURFACES)[number],
    capacity: 10,
    address: { street: "", city: "", province: "ON" as (typeof PROVINCES)[number], postalCode: "" },
    cancellationHours: 24,
  });
  const [hours, setHours] = useState<HoursRow[]>(defaultHours());

  useEffect(() => {
    apiFetch<{ data: VendorProfile }>("/vendor/profile")
      .then((r) => setFacilityName(r.data.businessName))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load vendor profile"));
  }, []);

  function setAddr<K extends keyof typeof form.address>(k: K, v: (typeof form.address)[K]) {
    setForm((f) => ({ ...f, address: { ...f.address, [k]: v } }));
  }

  function toggleDay(day: number) {
    setHours((h) => h.map((r) => r.day === day ? { ...r, isClosed: !r.isClosed } : r));
  }

  function setHourField(day: number, field: "openTime" | "closeTime", val: string) {
    setHours((h) => h.map((r) => r.day === day ? { ...r, [field]: val } : r));
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

    const remaining = MAX_PHOTOS - photos.length;
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
      setPhotos((current) => [...current, ...nextPhotos].slice(0, MAX_PHOTOS));
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Failed to upload photos");
    }
  }

  function removePhoto(index: number) {
    setPhotoError("");
    setPhotos((current) => current.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await apiFetch("/vendor/facilities", {
        method: "POST",
        body: JSON.stringify({
          description: form.description,
          sport: form.sport,
          surface: form.surface,
          capacity: form.capacity,
          images: photos,
          address: form.address,
          operatingHours: hours,
        }),
      });
      router.push("/dashboard/facilities");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create sport");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Header title="Add Sports" />
      <main className="flex-1 p-6 overflow-auto">
        <form onSubmit={handleSubmit} className="max-w-2xl space-y-8">

          {/* Basic info */}
          <section className="bg-surface border border-border rounded-dome p-6 space-y-4">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">Basic Info</h2>

            <Field label="Facility Name">
              <div className="w-full bg-black border border-border rounded-dome px-3 py-2.5 text-sm text-white">
                {facilityName || "Loading facility name..."}
              </div>
            </Field>

            <Field label="Description">
              <textarea required minLength={10} maxLength={2000} value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Describe your sports offering…" rows={3}
                className={inputCls + " resize-none"} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Sport">
                <select value={form.sport} onChange={(e) => setForm((f) => ({ ...f, sport: e.target.value as typeof form.sport }))} className={selectCls}>
                  {SPORTS.map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </Field>

              <Field label="Surface">
                <select value={form.surface} onChange={(e) => setForm((f) => ({ ...f, surface: e.target.value as typeof form.surface }))} className={selectCls}>
                  {SURFACES.map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Capacity (players)">
              <input type="number" required min={1} value={form.capacity}
                onChange={(e) => setForm((f) => ({ ...f, capacity: Number(e.target.value) }))}
                className={inputCls} style={{ maxWidth: 120 }} />
            </Field>

            <Field label={`Sports Photos (${photos.length}/${MAX_PHOTOS})`}>
              <div className="space-y-3">
                <label className={`inline-flex items-center justify-center bg-surface-2 border border-border rounded-dome px-4 py-2.5 text-sm font-semibold text-white transition-colors ${
                  photos.length >= MAX_PHOTOS ? "opacity-50 cursor-not-allowed" : "hover:border-primary cursor-pointer"
                }`}>
                  Upload Photos
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={photos.length >= MAX_PHOTOS}
                    onChange={handlePhotoUpload}
                    className="sr-only"
                  />
                </label>
                <p className="text-xs text-muted">Add up to 5 photos. Each photo must be under 2 MB.</p>
                {photoError && <p className="text-xs text-red-400">{photoError}</p>}
                {photos.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {photos.map((photo, index) => (
                      <div key={photo.slice(0, 40) + index} className="relative aspect-square overflow-hidden rounded-dome border border-border bg-black">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo} alt={`Sports photo ${index + 1}`} className="h-full w-full object-cover" />
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
            </Field>
          </section>

          {/* Address */}
          <section className="bg-surface border border-border rounded-dome p-6 space-y-4">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">Address</h2>

            <Field label="Street">
              <input type="text" required value={form.address.street}
                onChange={(e) => setAddr("street", e.target.value)}
                placeholder="123 Main St" className={inputCls} />
            </Field>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1">
                <Field label="City">
                  <input type="text" required value={form.address.city}
                    onChange={(e) => setAddr("city", e.target.value)}
                    placeholder="Toronto" className={inputCls} />
                </Field>
              </div>
              <Field label="Province">
                <select value={form.address.province} onChange={(e) => setAddr("province", e.target.value as typeof form.address.province)} className={selectCls}>
                  {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Postal Code">
                <input type="text" required value={form.address.postalCode}
                  onChange={(e) => setAddr("postalCode", e.target.value.toUpperCase())}
                  placeholder="M1A 1A1" maxLength={7} className={inputCls} />
              </Field>
            </div>
          </section>

          {/* Operating hours */}
          <section className="bg-surface border border-border rounded-dome p-6">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-4">Operating Hours</h2>
            <div className="space-y-3">
              {hours.map((row) => (
                <div key={row.day} className="flex items-center gap-3">
                  <span className="text-sm text-white w-20 shrink-0">{DAYS[row.day]}</span>

                  <button type="button" onClick={() => toggleDay(row.day)}
                    className={`w-10 h-5 rounded-full transition-colors shrink-0 ${row.isClosed ? "bg-border" : "bg-primary"}`}
                  >
                    <span className={`block w-4 h-4 bg-white rounded-full mx-0.5 transition-transform ${row.isClosed ? "" : "translate-x-5"}`} />
                  </button>

                  {row.isClosed ? (
                    <span className="text-sm text-muted">Closed</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input type="time" value={row.openTime}
                        onChange={(e) => setHourField(row.day, "openTime", e.target.value)}
                        className="bg-black border border-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-primary" />
                      <span className="text-muted text-sm">–</span>
                      <input type="time" value={row.closeTime}
                        onChange={(e) => setHourField(row.day, "closeTime", e.target.value)}
                        className="bg-black border border-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-primary" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Cancellation policy */}
          <section className="bg-surface border border-border rounded-dome p-6">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-4">Cancellation Policy</h2>
            <p className="text-xs text-muted mb-3">Free cancellation window before the booking slot.</p>
            <div className="flex gap-3">
              {[12, 24, 48].map((h) => (
                <label key={h} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="cancelPolicy" value={h}
                    checked={form.cancellationHours === h}
                    onChange={() => setForm((f) => ({ ...f, cancellationHours: h }))}
                    className="accent-primary" />
                  <span className={`text-sm font-medium ${form.cancellationHours === h ? "text-white" : "text-muted"}`}>{h}h</span>
                </label>
              ))}
            </div>
          </section>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <div className="flex gap-3">
            <button type="submit" disabled={isSubmitting}
              className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold px-6 py-3 rounded-dome transition-colors">
              {isSubmitting ? "Creating…" : "Create Sports"}
            </button>
            <button type="button" onClick={() => router.back()}
              className="px-6 py-3 text-sm text-muted hover:text-white bg-surface-2 border border-border rounded-dome transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </main>
    </>
  );
}
