"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, setToken, setRefreshToken, setStoredUser } from "../lib/api";
import { isAuthenticated, requireVendorAuth } from "../lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Show congratulations banner when redirected here after admin approval
  const justApproved = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("approved") === "true"
    : false;

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated()) router.replace("/dashboard");
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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
      const response = await fetch(`${apiUrl}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: otp }),
      });
      const data = await response.json() as {
        data?: {
          accessToken?: string;
          refreshToken?: string;
          vendorStatus?: "APPROVED" | "PENDING" | "REJECTED" | "NONE";
          user?: { role?: string; firstName?: string; lastName?: string; phone?: string; id?: string; businessName?: string };
          vendor?: { businessName?: string };
        };
        message?: string;
      };

      if (!response.ok) {
        throw new Error(data.message ?? `HTTP ${response.status}`);
      }

      const user = data.data?.user;
      const businessName = data.data?.vendor?.businessName ?? user?.businessName;
      const accessToken = data.data!.accessToken!;

      // Save tokens + user
      setToken(accessToken);
      if (data.data?.refreshToken) setRefreshToken(data.data.refreshToken);
      if (businessName) {
        localStorage.setItem("businessName", businessName);
      }
      setStoredUser({
        id:           user?.id ?? "",
        phone:        user?.phone ?? "",
        firstName:    user?.firstName ?? "",
        lastName:     user?.lastName ?? "",
        role:         user?.role ?? "PLAYER",
        businessName,
      });

      // Always fetch live vendor status with the fresh token — never rely on
      // what the auth endpoint cached, since approval changes status out-of-band.
      const statusApiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
      let vendorStatus: string = "NONE";
      try {
        const statusRes = await fetch(`${statusApiUrl}/vendor/application-status`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (statusRes.ok) {
          const statusData = await statusRes.json() as { data?: { status?: string } };
          vendorStatus = statusData.data?.status ?? "NONE";
        }
      } catch {
        // Fall back to the auth response value if the status check fails
        vendorStatus = data.data?.vendorStatus ?? "NONE";
      }

      // Route based on live status from DB
      if (vendorStatus === "APPROVED") {
        router.replace("/dashboard");
      } else if (vendorStatus === "PENDING") {
        router.replace("/pending");
      } else if (vendorStatus === "REJECTED") {
        router.replace("/rejected");
      } else {
        // NONE — new user or player, go to onboarding
        router.replace("/onboarding");
      }
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

        {justApproved && (
          <div className="bg-green-900/40 border border-green-700 text-green-400 text-sm font-semibold text-center px-4 py-3 rounded-dome mb-6">
            🎉 Your application was approved! Sign in to access your dashboard.
          </div>
        )}

        <p className="text-sm font-semibold text-muted mb-3 text-center">Already a vendor? Sign in</p>

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

        {/* Divider */}
        <div className="flex items-center gap-3 mt-6">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Become a Vendor CTA */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted mb-3">Want to list your sports business on Dome?</p>
          <a
            href="/onboarding"
            className="inline-block border border-primary text-primary font-bold px-8 py-3 rounded-dome text-sm hover:bg-primary hover:text-white transition-colors"
          >
            Become a Vendor →
          </a>
        </div>

        <p className="text-center text-xs text-muted mt-6">
          Dome Vendor Portal · For sports managers only
        </p>
      </div>
    </div>
  );
}
