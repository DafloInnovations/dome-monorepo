"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { API_URL } from "../../lib/api";
import { isAuthenticated, setToken, setStoredUser } from "../../lib/auth";

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("redirect") ?? "/";

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp]   = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAuthenticated()) router.replace(redirect);
  }, [redirect, router]);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(b.message ?? "Failed to send code");
      }
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: otp }),
      });
      const data = await res.json() as { data?: { accessToken?: string; user?: { id?: string; phone?: string; firstName?: string; lastName?: string; role?: string; creditBalanceCAD?: number } }; message?: string };
      if (!res.ok) throw new Error(data.message ?? "Invalid code");

      const user = data.data?.user;
      setToken(data.data!.accessToken!);
      setStoredUser({
        id:               user?.id ?? "",
        phone:            user?.phone ?? "",
        firstName:        user?.firstName ?? "",
        lastName:         user?.lastName ?? "",
        role:             user?.role ?? "PLAYER",
        creditBalanceCAD: user?.creditBalanceCAD,
      });
      router.replace(redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setIsLoading(false);
    }
  }

  const inputCls = "w-full bg-black border border-border rounded-dome px-4 py-3 text-white placeholder:text-muted focus:outline-none focus:border-primary transition-colors text-sm";

  return (
    <main className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-black text-white tracking-tight">DOME</Link>
          <p className="text-muted text-sm mt-1">Sign in to book courts</p>
        </div>

        <div className="bg-surface border border-border rounded-dome p-8">
          {step === "phone" ? (
            <>
              <h2 className="text-lg font-bold text-white mb-1">Welcome back</h2>
              <p className="text-sm text-muted mb-6">Enter your phone number to continue.</p>
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-2">Phone Number</label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 416 555 0123" required className={inputCls} />
                </div>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <button type="submit" disabled={isLoading || !phone}
                  className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold py-3 rounded-dome transition-colors text-sm">
                  {isLoading ? "Sending…" : "Send Code"}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold text-white mb-1">Enter your code</h2>
              <p className="text-sm text-muted mb-6">Sent to <span className="text-white">{phone}</span></p>
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-2">6-Digit Code</label>
                  <input type="text" value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000" maxLength={6} required
                    className={`${inputCls} text-center text-2xl tracking-widest font-mono`} />
                </div>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <button type="submit" disabled={isLoading || otp.length < 6}
                  className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold py-3 rounded-dome transition-colors text-sm">
                  {isLoading ? "Verifying…" : "Verify & Sign In"}
                </button>
                <button type="button" onClick={() => { setStep("phone"); setOtp(""); setError(""); }}
                  className="w-full text-sm text-muted hover:text-white transition-colors">
                  ← Change number
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted mt-6">
          By continuing you agree to our{" "}
          <a href="#" className="underline hover:text-white">Terms</a> and{" "}
          <a href="#" className="underline hover:text-white">Privacy Policy</a>.
        </p>

        <div className="text-center mt-4">
          <Link href="/facilities" className="text-sm text-muted hover:text-white transition-colors">
            Continue as guest →
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-[calc(100vh-64px)] bg-black" />}>
      <LoginContent />
    </Suspense>
  );
}
