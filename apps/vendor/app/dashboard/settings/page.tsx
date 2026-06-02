"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../../../components/layout/Header";
import { apiFetch } from "../../../lib/api";
import { clearToken } from "../../../lib/api";

interface VendorProfile {
  id: string;
  businessName: string;
  businessEmail: string | null;
  businessPhone: string | null;
  website: string | null;
  description: string | null;
  city: string | null;
  province: string;
  postalCode: string | null;
  sports: string[];
  status: string;
  stripeOnboardingComplete: boolean;
}

const inputCls = "w-full bg-black border border-border rounded-dome px-3 py-2.5 text-sm text-white placeholder:text-muted focus:outline-none focus:border-primary transition-colors";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">{label}</label>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving,  setIsSaving]  = useState(false);
  const [error,     setError]     = useState("");
  const [saved,     setSaved]     = useState(false);

  const [form, setForm] = useState({
    businessName:  "",
    businessEmail: "",
    businessPhone: "",
    website:       "",
    description:   "",
  });

  useEffect(() => {
    apiFetch<{ data: VendorProfile }>("/vendor/profile")
      .then((r) => {
        setProfile(r.data);
        setForm({
          businessName:  r.data.businessName,
          businessEmail: r.data.businessEmail ?? "",
          businessPhone: r.data.businessPhone ?? "",
          website:       r.data.website ?? "",
          description:   r.data.description ?? "",
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setIsLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError("");
    setSaved(false);
    try {
      await apiFetch("/vendor/profile", {
        method: "PUT",
        body: JSON.stringify(form),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  }

  function handleSignOut() {
    clearToken();
    router.replace("/");
  }

  return (
    <>
      <Header title="Settings" />
      <main className="flex-1 p-6 overflow-auto max-w-2xl">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-surface border border-border rounded-dome animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">

            {/* Business profile */}
            <section className="bg-surface border border-border rounded-dome p-6">
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-5">Business Profile</h2>
              <form onSubmit={handleSave} className="space-y-4">
                <Field label="Business Name">
                  <input type="text" value={form.businessName}
                    onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
                    className={inputCls} />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Business Email">
                    <input type="email" value={form.businessEmail}
                      onChange={(e) => setForm((f) => ({ ...f, businessEmail: e.target.value }))}
                      placeholder="hello@yourclub.ca" className={inputCls} />
                  </Field>
                  <Field label="Business Phone">
                    <input type="tel" value={form.businessPhone}
                      onChange={(e) => setForm((f) => ({ ...f, businessPhone: e.target.value }))}
                      placeholder="+1 416 555 0123" className={inputCls} />
                  </Field>
                </div>

                <Field label="Website">
                  <input type="url" value={form.website}
                    onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                    placeholder="https://yourclub.ca" className={inputCls} />
                </Field>

                <Field label="Description">
                  <textarea value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={3} className={inputCls + " resize-none"} />
                </Field>

                {error && <p className="text-red-400 text-sm">{error}</p>}
                {saved && <p className="text-green-400 text-sm">✓ Changes saved</p>}

                <button type="submit" disabled={isSaving}
                  className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-dome transition-colors text-sm">
                  {isSaving ? "Saving…" : "Save Changes"}
                </button>
              </form>
            </section>

            {/* Account info */}
            <section className="bg-surface border border-border rounded-dome p-6">
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-4">Account</h2>
              <div className="space-y-3 text-sm mb-5">
                <div className="flex justify-between">
                  <span className="text-muted">Status</span>
                  <span className={`font-semibold ${profile?.status === "APPROVED" ? "text-green-400" : "text-yellow-400"}`}>
                    {profile?.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Location</span>
                  <span className="text-white">{profile?.city ? `${profile.city}, ` : ""}{profile?.province}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Sports</span>
                  <span className="text-white">{profile?.sports.join(", ") || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Stripe</span>
                  <span className={profile?.stripeOnboardingComplete ? "text-green-400" : "text-yellow-400"}>
                    {profile?.stripeOnboardingComplete ? "Connected" : "Not connected"}
                  </span>
                </div>
              </div>

              {!profile?.stripeOnboardingComplete && (
                <button
                  onClick={() => alert("Stripe Connect onboarding coming soon.")}
                  className="text-sm text-primary hover:underline font-medium"
                >
                  Connect Stripe for payouts →
                </button>
              )}
            </section>

            {/* Danger zone */}
            <section className="bg-surface border border-border rounded-dome p-6">
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-4">Danger Zone</h2>
              <div className="space-y-3">
                <button onClick={handleSignOut}
                  className="w-full text-left px-4 py-3 bg-surface-2 border border-border rounded-dome text-sm text-white hover:border-red-800 transition-colors">
                  Sign Out
                </button>
                <button
                  onClick={() => alert("To request account deletion, email support@dome.ca")}
                  className="w-full text-left px-4 py-3 bg-surface-2 border border-red-900/30 rounded-dome text-sm text-red-400 hover:border-red-700 transition-colors"
                >
                  Request Account Deletion
                </button>
              </div>
            </section>

          </div>
        )}
      </main>
    </>
  );
}
