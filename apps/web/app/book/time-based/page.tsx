"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../../lib/api";
import { isAuthenticated } from "../../../lib/auth";

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("en-CA", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

function BookingContent() {
  const router = useRouter();
  const search = useSearchParams();

  const facilityId    = search.get("facilityId") ?? "";
  const facilityName  = search.get("facilityName") ?? "Facility";
  const date          = search.get("date") ?? "";
  const startTime     = search.get("startTime") ?? "";
  const endTime       = search.get("endTime") ?? "";
  const courts        = search.get("courts") ?? "";
  const clientSecret  = search.get("clientSecret") ?? "";
  const totalCAD      = parseFloat(search.get("totalCAD") ?? "0");
  const subtotalCAD   = parseFloat(search.get("subtotalCAD") ?? String(totalCAD));
  const taxCAD        = parseFloat(search.get("taxCAD") ?? "0");
  const bookingId     = search.get("bookingId") ?? "";
  const groupId       = search.get("groupId") ?? "";

  const [step, setStep]         = useState<"summary" | "processing" | "error">("summary");
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
  }, [router]);

  async function handlePay() {
    if (!clientSecret) {
      setErrorMsg("Missing payment info. Please go back and try again.");
      return;
    }
    setIsLoading(true);
    setErrorMsg("");
    try {
      // Extract payment intent ID from Stripe client_secret (format: pi_xxx_secret_yyy)
      const paymentIntentId = clientSecret.split("_secret_")[0]!;
      setStep("processing");

      const confirmPath = groupId
        ? `/bookings/group/${groupId}/confirm`
        : `/bookings/${bookingId}/confirm`;

      await apiFetch(confirmPath, {
        method: "POST",
        body: JSON.stringify({ paymentIntentId }),
      });

      const confirmId = groupId || bookingId;
      router.replace(
        `/bookings/${confirmId}/confirmation?facilityName=${encodeURIComponent(facilityName)}&date=${date}&startTime=${startTime}&endTime=${endTime}&totalCAD=${totalCAD}`
      );
    } catch (err) {
      const status  = (err as { status?: number }).status;
      const message = err instanceof Error ? err.message : "Something went wrong";
      setStep("error");
      setErrorMsg(
        status === 409
          ? "This slot was just taken by another player. Please go back and choose a different time."
          : message
      );
      setIsLoading(false);
    }
  }

  if (step === "processing") {
    return (
      <main className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white font-semibold">Confirming your booking…</p>
          <p className="text-muted text-sm mt-1">Please don&apos;t close this page.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-12">
      <div className="mb-6">
        <Link href={`/facilities/${facilityId}`} className="text-sm text-muted hover:text-white transition-colors">
          ← Back to facility
        </Link>
        <h1 className="text-2xl font-black text-white mt-3">Complete Booking</h1>
      </div>

      <div className="bg-surface border border-border rounded-dome p-5 mb-4">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-4">Booking Summary</h2>
        <Row label="Facility" value={facilityName} />
        {date      && <Row label="Date"   value={formatDisplayDate(date)} />}
        {startTime && <Row label="Time"   value={`${startTime} – ${endTime}`} />}
        {courts    && <Row label="Courts" value={courts} />}
        <div className="border-t border-border mt-4 pt-4 space-y-2">
          <Row label="Subtotal"  value={`C$${subtotalCAD.toFixed(2)}`} />
          <Row label="Tax"       value={`C$${taxCAD.toFixed(2)}`} muted />
          <Row label="Total"     value={`C$${totalCAD.toFixed(2)}`} highlight />
        </div>
      </div>

      <div className="bg-surface border border-border rounded-dome p-5 mb-6">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-4">Payment</h2>
        <div className="bg-surface-2 border border-border rounded-dome p-4 text-center">
          <p className="text-muted text-sm">🔒 Secure payment via Stripe</p>
          <p className="text-xs text-muted mt-1">Card details collected at checkout</p>
        </div>
      </div>

      {step === "error" && (
        <div className="bg-red-900/30 border border-red-700 rounded-dome px-4 py-3 text-red-400 text-sm mb-4">
          {errorMsg}
        </div>
      )}

      <button
        onClick={handlePay}
        disabled={isLoading}
        className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold py-4 rounded-dome transition-colors text-base"
      >
        {isLoading ? "Processing…" : `Confirm & Pay C$${totalCAD.toFixed(2)}`}
      </button>

      <p className="text-center text-xs text-muted mt-4">
        By booking you agree to our cancellation policy.
      </p>
    </main>
  );
}

function Row({ label, value, muted, highlight }: {
  label: string; value: string; muted?: boolean; highlight?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-muted">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? "text-primary text-base" : muted ? "text-muted" : "text-white"}`}>
        {value}
      </span>
    </div>
  );
}

export default function TimeBasedBookingPage() {
  return (
    <Suspense fallback={
      <main className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </main>
    }>
      <BookingContent />
    </Suspense>
  );
}
