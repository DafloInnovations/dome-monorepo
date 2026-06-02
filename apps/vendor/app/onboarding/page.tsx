"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { getToken } from "../../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormData {
  businessName:  string;
  businessEmail: string;
  businessPhone: string;
  website:       string;
  description:   string;
  streetAddress: string;
  city:          string;
  province:      string;
  postalCode:    string;
  sports:        string[];
  agreedToTerms: boolean;
}

const EMPTY: FormData = {
  businessName: "", businessEmail: "", businessPhone: "", website: "", description: "",
  streetAddress: "", city: "", province: "ON", postalCode: "",
  sports: [], agreedToTerms: false,
};

const PROVINCES = ["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"];

const SPORTS_OPTIONS = [
  { slug: "BADMINTON",  label: "Badminton",  emoji: "🏸" },
  { slug: "PICKLEBALL", label: "Pickleball", emoji: "🏓" },
  { slug: "TENNIS",     label: "Tennis",     emoji: "🎾" },
  { slug: "BASKETBALL", label: "Basketball", emoji: "🏀" },
  { slug: "SOCCER",     label: "Soccer",     emoji: "⚽" },
  { slug: "CRICKET",    label: "Cricket",    emoji: "🏏" },
  { slug: "VOLLEYBALL", label: "Volleyball", emoji: "🏐" },
  { slug: "HOCKEY",     label: "Hockey",     emoji: "🏒" },
  { slug: "SQUASH",     label: "Squash",     emoji: "🎯" },
];

const STEP_TITLES = ["Business Info", "Location", "Sports & Details", "Review & Submit"];

const STORAGE_KEY = "dome_vendor_onboarding";

// ─── Validation ───────────────────────────────────────────────────────────────

function validateStep(step: number, form: FormData): Record<string, string> {
  const e: Record<string, string> = {};
  if (step === 0) {
    if (!form.businessName.trim()) e["businessName"] = "Business name is required";
    if (!form.businessEmail.trim()) e["businessEmail"] = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.businessEmail)) e["businessEmail"] = "Invalid email";
    if (!form.businessPhone.trim()) e["businessPhone"] = "Phone is required";
    if (!form.description.trim() || form.description.length < 20) e["description"] = "Description must be at least 20 characters";
  }
  if (step === 1) {
    if (!form.streetAddress.trim()) e["streetAddress"] = "Street address is required";
    if (!form.city.trim()) e["city"] = "City is required";
    if (!form.province) e["province"] = "Province is required";
    if (!form.postalCode.trim() || form.postalCode.length < 6) e["postalCode"] = "Valid postal code required";
  }
  if (step === 2) {
    if (form.sports.length === 0) e["sports"] = "Select at least one sport";
  }
  if (step === 3) {
    if (!form.agreedToTerms) e["agreedToTerms"] = "You must agree to the terms";
  }
  return e;
}

// ─── Field component ──────────────────────────────────────────────────────────

function Field({
  label, error, required, children,
}: { label: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
        {label}{required && <span className="text-primary ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}

const inputCls = "w-full bg-black border border-border rounded-dome px-3 py-2.5 text-sm text-white placeholder:text-muted focus:outline-none focus:border-primary transition-colors";
const selectCls = inputCls + " cursor-pointer";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep]   = useState(0);
  const [form, setForm]   = useState<FormData>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError]   = useState("");

  // Load saved progress
  useEffect(() => {
    if (!getToken()) { router.replace("/"); return; }
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setForm(JSON.parse(saved) as FormData);
    } catch {}
  }, [router]);

  // Persist progress
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  }, [form]);

  function set<K extends keyof FormData>(k: K, v: FormData[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => { const n = { ...e }; delete n[k]; return n; });
  }

  function toggleSport(slug: string) {
    setForm((f) => ({
      ...f,
      sports: f.sports.includes(slug) ? f.sports.filter((s) => s !== slug) : [...f.sports, slug],
    }));
    if (errors["sports"]) setErrors((e) => { const n = { ...e }; delete n["sports"]; return n; });
  }

  function handleNext() {
    const errs = validateStep(step, form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setStep((s) => s + 1);
    window.scrollTo(0, 0);
  }

  function handleBack() {
    setErrors({});
    setStep((s) => s - 1);
    window.scrollTo(0, 0);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateStep(3, form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setIsSubmitting(true);
    setSubmitError("");
    try {
      await apiFetch("/vendor/apply", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          website: form.website || undefined,
        }),
      });
      localStorage.removeItem(STORAGE_KEY);
      router.replace("/pending");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const progress = ((step + 1) / 4) * 100;

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-white tracking-tight">DOME</h1>
          <p className="text-muted text-sm mt-1">Vendor Application</p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide">
              Step {step + 1} of {STEP_TITLES.length}
            </p>
            <p className="text-xs text-muted">{STEP_TITLES[step]}</p>
          </div>
          <div className="h-1.5 bg-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            {STEP_TITLES.map((t, i) => (
              <div key={t} className="flex flex-col items-center">
                <div className={`w-2 h-2 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-border"}`} />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-dome p-6">
          {/* ── Step 0: Business Info ─────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-white">Business Information</h2>

              <Field label="Business Name" error={errors["businessName"]} required>
                <input type="text" value={form.businessName} onChange={(e) => set("businessName", e.target.value)}
                  placeholder="e.g. Scarborough Badminton Club" className={inputCls} />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Business Email" error={errors["businessEmail"]} required>
                  <input type="email" value={form.businessEmail} onChange={(e) => set("businessEmail", e.target.value)}
                    placeholder="hello@yourclub.ca" className={inputCls} />
                </Field>
                <Field label="Business Phone" error={errors["businessPhone"]} required>
                  <input type="tel" value={form.businessPhone} onChange={(e) => set("businessPhone", e.target.value)}
                    placeholder="+1 416 555 0123" className={inputCls} />
                </Field>
              </div>

              <Field label="Website (optional)">
                <input type="url" value={form.website} onChange={(e) => set("website", e.target.value)}
                  placeholder="https://yourclub.ca" className={inputCls} />
              </Field>

              <Field label="Facility Description" error={errors["description"]} required>
                <textarea value={form.description} onChange={(e) => set("description", e.target.value)}
                  placeholder="Describe your facility — courts, amenities, who it's for..."
                  rows={4} className={inputCls + " resize-none"} />
                <p className="text-xs text-muted mt-1">{form.description.length}/2000 · min 20 chars</p>
              </Field>
            </div>
          )}

          {/* ── Step 1: Location ──────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-white">Facility Location</h2>

              <Field label="Street Address" error={errors["streetAddress"]} required>
                <input type="text" value={form.streetAddress} onChange={(e) => set("streetAddress", e.target.value)}
                  placeholder="123 Main Street" className={inputCls} />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="City" error={errors["city"]} required>
                  <input type="text" value={form.city} onChange={(e) => set("city", e.target.value)}
                    placeholder="Toronto" className={inputCls} />
                </Field>
                <Field label="Province" error={errors["province"]} required>
                  <select value={form.province} onChange={(e) => set("province", e.target.value)} className={selectCls}>
                    {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Postal Code" error={errors["postalCode"]} required>
                <input type="text" value={form.postalCode}
                  onChange={(e) => set("postalCode", e.target.value.toUpperCase())}
                  placeholder="M1A 1A1" maxLength={7} className={inputCls} style={{ maxWidth: 140 }} />
              </Field>
            </div>
          )}

          {/* ── Step 2: Sports & Details ──────────────────────────── */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-white">Sports & Facility Details</h2>

              <Field label="Sports Offered" error={errors["sports"]} required>
                <div className="flex flex-wrap gap-2 mt-1">
                  {SPORTS_OPTIONS.map((s) => {
                    const active = form.sports.includes(s.slug);
                    return (
                      <button
                        key={s.slug}
                        type="button"
                        onClick={() => toggleSport(s.slug)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-full border text-sm font-medium transition-colors ${
                          active
                            ? "bg-primary border-primary text-white"
                            : "bg-black border-border text-muted hover:text-white hover:border-primary/50"
                        }`}
                      >
                        <span>{s.emoji}</span>
                        <span>{s.label}</span>
                        {active && <span className="ml-0.5 text-xs">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <div className="bg-surface-2 border border-border rounded-dome p-4 text-sm text-muted">
                <p>
                  <span className="text-white font-semibold">{form.sports.length}</span> sport{form.sports.length !== 1 ? "s" : ""} selected
                  {form.sports.length > 0 && `: ${form.sports.join(", ")}`}
                </p>
              </div>
            </div>
          )}

          {/* ── Step 3: Review & Submit ───────────────────────────── */}
          {step === 3 && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <h2 className="text-lg font-bold text-white">Review & Submit</h2>

              <div className="space-y-3">
                {[
                  { label: "Business", value: form.businessName },
                  { label: "Email",    value: form.businessEmail },
                  { label: "Phone",    value: form.businessPhone },
                  { label: "Location", value: `${form.streetAddress}, ${form.city}, ${form.province} ${form.postalCode}` },
                  { label: "Sports",   value: form.sports.join(", ") || "None selected" },
                  { label: "Website",  value: form.website || "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex gap-3 text-sm">
                    <span className="text-muted w-20 shrink-0">{label}</span>
                    <span className="text-white break-words">{value}</span>
                  </div>
                ))}
                <div className="text-sm">
                  <p className="text-muted mb-1">Description</p>
                  <p className="text-white/80 text-xs leading-relaxed">{form.description}</p>
                </div>
              </div>

              <div className="border-t border-border pt-5">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.agreedToTerms}
                    onChange={(e) => set("agreedToTerms", e.target.checked)}
                    className="mt-0.5 accent-primary"
                  />
                  <span className="text-sm text-muted leading-relaxed">
                    I agree to the{" "}
                    <a href="#" className="text-primary hover:underline">Dome Vendor Terms</a>{" "}
                    and confirm that all information provided is accurate.
                  </span>
                </label>
                {errors["agreedToTerms"] && (
                  <p className="text-red-400 text-xs mt-1">{errors["agreedToTerms"]}</p>
                )}
              </div>

              {submitError && (
                <div className="bg-red-900/30 border border-red-700 rounded-dome px-4 py-3 text-red-400 text-sm">
                  {submitError}
                </div>
              )}

              <button type="submit" disabled={isSubmitting}
                className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold py-3 rounded-dome transition-colors">
                {isSubmitting ? "Submitting…" : "Submit Application"}
              </button>
            </form>
          )}
        </div>

        {/* Navigation */}
        {step < 3 && (
          <div className="flex gap-3 mt-4">
            {step > 0 && (
              <button onClick={handleBack}
                className="flex-1 py-3 text-sm font-medium text-muted hover:text-white bg-surface border border-border rounded-dome transition-colors">
                ← Back
              </button>
            )}
            <button onClick={handleNext}
              className="flex-1 bg-primary hover:bg-primary-hover text-white font-bold py-3 rounded-dome transition-colors text-sm">
              Continue →
            </button>
          </div>
        )}
        {step === 3 && step > 0 && (
          <button onClick={handleBack}
            className="w-full mt-3 py-3 text-sm text-muted hover:text-white bg-surface border border-border rounded-dome transition-colors">
            ← Back to edit
          </button>
        )}

        <p className="text-center text-xs text-muted mt-6">
          Progress is saved automatically.
        </p>
      </div>
    </div>
  );
}
