"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, setToken, setStoredUser } from "../lib/api";
import { isAuthenticated, requireVendorAuth } from "../lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Redirect if already authenticated
  useEffect(() => {
    if (requireVendorAuth()) router.replace("/dashboard");
  }, [router]);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await api.auth.sendOtp(phone);
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const res = await api.auth.verifyOtp(phone, otp);
      const { accessToken, user } = res.data;

      if (user.role !== "VENDOR") {
        setError("This portal is for vendors only. Please contact support.");
        return;
      }

      setToken(accessToken);
      setStoredUser(user);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-white tracking-tight">DOME</h1>
          <p className="text-muted text-sm mt-1">Vendor Portal</p>
        </div>

        <div className="bg-surface rounded-dome border border-border p-8">
          {step === "phone" ? (
            <>
              <h2 className="text-lg font-bold text-white mb-1">Sign in</h2>
              <p className="text-sm text-muted mb-6">Enter your phone number to receive a verification code.</p>

              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 416 555 0123"
                    required
                    className="w-full bg-black border border-border rounded-dome px-4 py-3 text-white placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                {error && <p className="text-red-400 text-sm">{error}</p>}

                <button
                  type="submit"
                  disabled={isLoading || !phone}
                  className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold py-3 rounded-dome transition-colors"
                >
                  {isLoading ? "Sending…" : "Send Code"}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold text-white mb-1">Enter code</h2>
              <p className="text-sm text-muted mb-6">
                We sent a 6-digit code to <span className="text-white">{phone}</span>.
              </p>

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                    Verification Code
                  </label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    required
                    className="w-full bg-black border border-border rounded-dome px-4 py-3 text-white placeholder:text-muted text-center text-2xl tracking-widest font-mono focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                {error && <p className="text-red-400 text-sm">{error}</p>}

                <button
                  type="submit"
                  disabled={isLoading || otp.length < 6}
                  className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold py-3 rounded-dome transition-colors"
                >
                  {isLoading ? "Verifying…" : "Verify & Sign In"}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep("phone"); setOtp(""); setError(""); }}
                  className="w-full text-sm text-muted hover:text-white transition-colors"
                >
                  ← Change number
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted mt-6">
          Dome Vendor Portal · For facility managers only
        </p>
      </div>
    </div>
  );
}
