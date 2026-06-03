"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "../lib/api";
import { isAdmin, setToken, setStoredUser } from "../lib/auth";

export default function AdminLogin() {
  const router = useRouter();
  const [step, setStep]   = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp]     = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAdmin()) router.replace("/dashboard");
  }, [router]);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const body = await res.json() as { message?: string };
      if (!res.ok) throw new Error(body.message ?? "Failed to send code");
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
      const data = await res.json() as {
        data?: { accessToken?: string; user?: { id?: string; phone?: string; firstName?: string; lastName?: string; role?: string } };
        message?: string;
      };
      if (!res.ok) throw new Error(data.message ?? "Invalid code");

      const user = data.data?.user;
      if (user?.role !== "ADMIN") {
        setError("Access denied. This portal is for Dome administrators only.");
        return;
      }

      setToken(data.data!.accessToken!);
      setStoredUser({
        id: user.id ?? "", phone: user.phone ?? "",
        firstName: user.firstName ?? "", lastName: user.lastName ?? "",
        role: user.role,
      });
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setIsLoading(false);
    }
  }

  const inputCls = "w-full bg-black border border-border rounded-dome px-4 py-3 text-white placeholder:text-muted focus:outline-none focus:border-primary transition-colors text-sm";

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-4xl font-black text-white tracking-tight">DOME</p>
          <p className="text-primary text-xs font-bold uppercase tracking-widest mt-1">Admin Panel</p>
        </div>

        <div className="bg-surface border border-border rounded-dome p-8">
          {step === "phone" ? (
            <>
              <h2 className="text-lg font-bold text-white mb-1">Administrator Sign In</h2>
              <p className="text-sm text-muted mb-6">Enter your phone number to receive a code.</p>
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
              <h2 className="text-lg font-bold text-white mb-1">Enter Code</h2>
              <p className="text-sm text-muted mb-6">Sent to <span className="text-white">{phone}</span></p>
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-2">Verification Code</label>
                  <input type="text" value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000" maxLength={6} required
                    className={`${inputCls} text-center text-2xl tracking-widest font-mono`} />
                </div>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <button type="submit" disabled={isLoading || otp.length < 6}
                  className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold py-3 rounded-dome transition-colors text-sm">
                  {isLoading ? "Verifying…" : "Sign In"}
                </button>
                <button type="button" onClick={() => { setStep("phone"); setOtp(""); setError(""); }}
                  className="w-full text-sm text-muted hover:text-white transition-colors">← Change number</button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted mt-6">Restricted access · Dome Operations</p>
      </div>
    </div>
  );
}
