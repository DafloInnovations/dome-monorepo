"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, getToken, setToken, setStoredUser } from "../../lib/api";

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

// Step 0 = phone auth; steps 1–4 = form steps
const FORM_STEP_TITLES = ["Business Info", "Location", "Sports", "Review & Submit"];

const STORAGE_KEY = "dome_vendor_onboarding";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

// ─── Validation ───────────────────────────────────────────────────────────────

function validateFormStep(step: number, form: FormData): Record<string, string> {
  const e: Record<string, string> = {};
  if (step === 1) {
    if (!form.businessName.trim())  e["businessName"]  = "Business name is required";
    if (!form.businessEmail.trim()) e["businessEmail"] = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.businessEmail)) e["businessEmail"] = "Invalid email";
    if (!form.description.trim() || form.description.length < 20) e["description"] = "Description must be at least 20 characters";
  }
  if (step === 2) {
    if (!form.streetAddress.trim()) e["streetAddress"] = "Street address is required";
    if (!form.city.trim())          e["city"]          = "City is required";
    if (!form.postalCode.trim() || form.postalCode.length < 6) e["postalCode"] = "Valid postal code required";
  }
  if (step === 3) {
    if (form.sports.length === 0) e["sports"] = "Select at least one sport";
  }
  if (step === 4) {
    if (!form.agreedToTerms) e["agreedToTerms"] = "You must agree to the terms";
  }
  return e;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({ label, error, required, children }: {
  label: string; error?: string; required?: boolean; children: React.ReactNode;
}) {
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

const inputCls  = "w-full bg-black border border-border rounded-dome px-3 py-2.5 text-sm text-white placeholder:text-muted focus:outline-none focus:border-primary transition-colors";
const selectCls = inputCls + " cursor-pointer";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();

  // step 0 = phone auth; 1–4 = form
  const [step, setStep]   = useState(0);
  const [form, setForm]   = useState<FormData>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError]   = useState("");

  // Phone auth state (step 0)
  const [phone, setPhone]       = useState("");
  const [otp, setOtp]           = useState("");
  const [otpSent, setOtpSent]   = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError]     = useState("");

  // If already authenticated, skip to step 1
  useEffect(() => {
    if (getToken()) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) setForm(JSON.parse(saved) as FormData);
      } catch {}
      setStep(1);
    }
  }, []);

  // Persist form progress
  useEffect(() => {
    if (step >= 1) localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  }, [form, step]);

  // ── Auth handlers ─────────────────────────────────────────────────────────

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(""); setAuthLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const body = await res.json() as { message?: string };
      if (!res.ok) throw new Error(body.message ?? "Failed to send code");
      setOtpSent(true);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(""); setAuthLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: otp }),
      });
      const data = await res.json() as {
        data?: {
          accessToken?: string;
          vendorStatus?: "APPROVED" | "PENDING" | "REJECTED" | "NONE";
          user?: { id?: string; phone?: string; firstName?: string; lastName?: string; role?: string };
        };
        message?: string;
      };
      if (!res.ok) throw new Error(data.message ?? "Invalid code");

      const user = data.data?.user;
      setToken(data.data!.accessToken!);
      setStoredUser({
        id: user?.id ?? "", phone: user?.phone ?? "",
        firstName: user?.firstName ?? "", lastName: user?.lastName ?? "",
        role: user?.role ?? "PLAYER",
      });

      // If already an approved vendor, go straight to dashboard
      const vs = data.data?.vendorStatus;
      if (vs === "APPROVED")  { router.replace("/dashboard"); return; }
      if (vs === "PENDING")   { router.replace("/pending");   return; }
      if (vs === "REJECTED")  { router.replace("/rejected");  return; }

      // Load any saved progress, then move to step 1
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) setForm(JSON.parse(saved) as FormData);
      } catch {}
      setStep(1);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setAuthLoading(false);
    }
  }

  // ── Form handlers ─────────────────────────────────────────────────────────

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
    const errs = validateFormStep(step, form);
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
    const errs = validateFormStep(4, form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setIsSubmitting(true); setSubmitError("");
    try {
      await apiFetch("/vendor/apply", {
        method: "POST",
        body: JSON.stringify({ ...form, website: form.website || undefined }),
      });
      localStorage.removeItem(STORAGE_KEY);
      router.replace("/pending");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Progress bar (only for form steps 1–4) ───────────────────────────────
  const formProgress = step === 0 ? 0 : ((step) / 4) * 100;

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-white tracking-tight">DOME</h1>
          <p className="text-muted text-sm mt-1">Vendor Application</p>
        </div>

        <div className="mb-4">
          <Link
            href="/"
            className="inline-flex items-center text-sm font-medium text-muted hover:text-white transition-colors"
          >
            ← Back to login
          </Link>
        </div>

        {/* Progress bar — hidden on step 0 */}
        {step > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide">
                Step {step} of {FORM_STEP_TITLES.length}
              </p>
              <p className="text-xs text-muted">{FORM_STEP_TITLES[step - 1]}</p>
            </div>
            <div className="h-1.5 bg-surface rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${formProgress}%` }} />
            </div>
            <div className="flex justify-between mt-2">
              {FORM_STEP_TITLES.map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i < step ? "bg-primary" : "bg-border"}`} />
              ))}
            </div>
          </div>
        )}

        <div className="bg-surface border border-border rounded-dome p-6">

          {/* ── Step 0: Phone + OTP ─────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Welcome to Dome</h2>
                <p className="text-sm text-muted">Let&apos;s start with your phone number to create or verify your account.</p>
              </div>

              {!otpSent ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <Field label="Phone Number" required>
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 416 555 0123" required className={inputCls} />
                  </Field>
                  {authError && <p className="text-red-400 text-sm">{authError}</p>}
                  <button type="submit" disabled={authLoading || !phone}
                    className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold py-3 rounded-dome transition-colors text-sm">
                    {authLoading ? "Sending…" : "Send Verification Code"}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <p className="text-sm text-muted">
                    Code sent to <span className="text-white font-medium">{phone}</span>
                  </p>
                  <Field label="6-Digit Code" required>
                    <input type="text" value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000" maxLength={6} required
                      className={inputCls + " text-center text-2xl tracking-widest font-mono"} />
                  </Field>
                  {authError && <p className="text-red-400 text-sm">{authError}</p>}
                  <button type="submit" disabled={authLoading || otp.length < 6}
                    className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold py-3 rounded-dome transition-colors text-sm">
                    {authLoading ? "Verifying…" : "Verify & Continue →"}
                  </button>
                  <button type="button" onClick={() => { setOtpSent(false); setOtp(""); setAuthError(""); }}
                    className="w-full text-sm text-muted hover:text-white transition-colors">
                    ← Change number
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ── Step 1: Business Info ────────────────────────────── */}
          {step === 1 && (
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
                <Field label="Business Phone">
                  <input type="tel" value={form.businessPhone} onChange={(e) => set("businessPhone", e.target.value)}
                    placeholder="+1 416 555 0123" className={inputCls} />
                </Field>
              </div>

              <Field label="Website (optional)">
                <input type="url" value={form.website} onChange={(e) => set("website", e.target.value)}
                  placeholder="https://yourclub.ca" className={inputCls} />
              </Field>

              <Field label="Sports Description" error={errors["description"]} required>
                <textarea value={form.description} onChange={(e) => set("description", e.target.value)}
                  placeholder="Describe your sports business — courts, amenities, who it's for..."
                  rows={4} className={inputCls + " resize-none"} />
                <p className="text-xs text-muted mt-1">{form.description.length}/2000 · min 20 chars</p>
              </Field>
            </div>
          )}

          {/* ── Step 2: Location ─────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-white">Sports Location</h2>

              <Field label="Street Address" error={errors["streetAddress"]} required>
                <input type="text" value={form.streetAddress} onChange={(e) => set("streetAddress", e.target.value)}
                  placeholder="123 Main Street" className={inputCls} />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="City" error={errors["city"]} required>
                  <input type="text" value={form.city} onChange={(e) => set("city", e.target.value)}
                    placeholder="Toronto" className={inputCls} />
                </Field>
                <Field label="Province" required>
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

          {/* ── Step 3: Sports ───────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-white">Sports Details</h2>

              <Field label="Sports Offered" error={errors["sports"]} required>
                <div className="flex flex-wrap gap-2 mt-1">
                  {SPORTS_OPTIONS.map((s) => {
                    const active = form.sports.includes(s.slug);
                    return (
                      <button key={s.slug} type="button" onClick={() => toggleSport(s.slug)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-full border text-sm font-medium transition-colors ${
                          active
                            ? "bg-primary border-primary text-white"
                            : "bg-black border-border text-muted hover:text-white hover:border-primary/50"
                        }`}>
                        <span>{s.emoji}</span>
                        <span>{s.label}</span>
                        {active && <span className="text-xs ml-0.5">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </Field>

              {form.sports.length > 0 && (
                <div className="bg-surface-2 border border-border rounded-dome p-3 text-sm text-muted">
                  <span className="text-white font-semibold">{form.sports.length}</span> sport{form.sports.length !== 1 ? "s" : ""} selected
                </div>
              )}
            </div>
          )}

          {/* ── Step 4: Review & Submit ──────────────────────────── */}
          {step === 4 && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <h2 className="text-lg font-bold text-white">Review & Submit</h2>

              <div className="space-y-2.5">
                {[
                  { label: "Business", value: form.businessName },
                  { label: "Email",    value: form.businessEmail },
                  { label: "Phone",    value: form.businessPhone || "—" },
                  { label: "Location", value: `${form.streetAddress}, ${form.city}, ${form.province} ${form.postalCode}` },
                  { label: "Sports",   value: form.sports.join(", ") || "None" },
                  { label: "Website",  value: form.website || "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex gap-3 text-sm">
                    <span className="text-muted w-20 shrink-0">{label}</span>
                    <span className="text-white break-words">{value}</span>
                  </div>
                ))}
                <div className="text-sm pt-1">
                  <p className="text-muted mb-1">Description</p>
                  <p className="text-white/80 text-xs leading-relaxed">{form.description}</p>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.agreedToTerms}
                    onChange={(e) => set("agreedToTerms", e.target.checked)}
                    className="mt-0.5 accent-primary" />
                  <span className="text-sm text-muted leading-relaxed">
                    I agree to the{" "}
                    <a href="#" className="text-primary hover:underline">Dome Vendor Terms</a>{" "}
                    and confirm that all information provided is accurate.
                  </span>
                </label>
                {errors["agreedToTerms"] && <p className="text-red-400 text-xs mt-1">{errors["agreedToTerms"]}</p>}
              </div>

              {submitError && (
                <div className="bg-red-900/30 border border-red-700 rounded-dome px-4 py-3 text-red-400 text-sm">
                  {submitError}
                </div>
              )}

              <button type="submit" disabled={isSubmitting}
                className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold py-3 rounded-dome transition-colors text-sm">
                {isSubmitting ? "Submitting…" : "Submit Application"}
              </button>
            </form>
          )}
        </div>

        {/* Navigation buttons (form steps only) */}
        {step >= 1 && step <= 3 && (
          <div className="flex gap-3 mt-4">
            <button onClick={handleBack}
              className="flex-1 py-3 text-sm font-medium text-muted hover:text-white bg-surface border border-border rounded-dome transition-colors">
              ← Back
            </button>
            <button onClick={handleNext}
              className="flex-1 bg-primary hover:bg-primary-hover text-white font-bold py-3 rounded-dome transition-colors text-sm">
              Continue →
            </button>
          </div>
        )}
        {step === 4 && (
          <button onClick={handleBack}
            className="w-full mt-3 py-3 text-sm text-muted hover:text-white bg-surface border border-border rounded-dome transition-colors">
            ← Back to edit
          </button>
        )}

        {step >= 1 && (
          <p className="text-center text-xs text-muted mt-4">Progress saved automatically.</p>
        )}
      </div>
    </div>
  );
}
