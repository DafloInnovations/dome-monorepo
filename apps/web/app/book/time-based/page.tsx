"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { apiFetch } from "../../../lib/api";
import { getStripe } from "../../../lib/stripe";
import { isAuthenticated } from "../../../lib/auth";

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("en-CA", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
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

// ─── Payment form (inside Elements provider) ──────────────────────────────────

function PaymentForm({
  bookingId, groupId, facilityId, facilityName,
  date, startTime, endTime, totalCAD,
  creditsApplied, clientSecret,
}: {
  bookingId: string; groupId: string; facilityId: string; facilityName: string;
  date: string; startTime: string; endTime: string; totalCAD: number;
  creditsApplied: number; clientSecret: string;
}) {
  const stripe   = useStripe();
  const elements = useElements();
  const router   = useRouter();

  // "paying"    = Stripe confirmPayment in flight (form stays mounted)
  // "serverConfirm" = server-side confirm after Stripe succeeds (spinner OK — Stripe is done)
  const [paying,        setPaying]       = useState(false);
  const [serverConfirm, setServerConfirm] = useState(false);
  const [errorMsg,      setErrorMsg]     = useState("");
  const [peReady,       setPeReady]      = useState(false);
  const [peLoadError,   setPeLoadError]  = useState(false);

  const isPaidByCredits = clientSecret === "credits";

  const confirmOnServer = useCallback(async (paymentIntentId: string) => {
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
  }, [bookingId, groupId, facilityName, date, startTime, endTime, totalCAD, router]);

  // Credits-only path: no card needed — just confirm on the server
  async function handleCreditsOnly() {
    setServerConfirm(true);
    try {
      await confirmOnServer("credits");
    } catch (err) {
      setServerConfirm(false);
      setErrorMsg(err instanceof Error ? err.message : "Booking failed");
    }
  }

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements || !peReady) return;
    // Keep the form mounted — only disable the button while Stripe is working
    setPaying(true);
    setErrorMsg("");

    // Required by Stripe: validate card fields before confirming
    const { error: submitError } = await elements.submit();
    if (submitError) {
      setErrorMsg(submitError.message ?? "Invalid card details");
      setPaying(false);
      return;
    }

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/bookings/${groupId || bookingId}/confirmation`,
      },
      redirect: "if_required",
    });

    if (confirmError) {
      // Stripe rejected — show error, re-enable form
      setPaying(false);
      setErrorMsg(confirmError.message ?? "Payment failed");
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      // Stripe is done — safe to swap in spinner and call server
      setServerConfirm(true);
      try {
        await confirmOnServer(paymentIntent.id);
      } catch (err) {
        setServerConfirm(false);
        setPaying(false);
        setErrorMsg(err instanceof Error ? err.message : "Booking confirmation failed");
      }
    } else {
      setPaying(false);
      setErrorMsg("Payment was not completed. Please try again.");
    }
  }

  if (serverConfirm) {
    return (
      <div className="flex flex-col items-center py-12 gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-white font-semibold">Confirming your booking…</p>
        <p className="text-muted text-sm">Please don&apos;t close this page.</p>
      </div>
    );
  }

  if (isPaidByCredits) {
    return (
      <div className="space-y-4">
        <div className="bg-green-950/30 border border-green-900/40 rounded-dome p-4 text-center">
          <p className="text-green-400 font-semibold">💳 Paid in full with Dome Credits</p>
          <p className="text-green-400/70 text-sm mt-1">No card charge — C${creditsApplied.toFixed(2)} credits applied</p>
        </div>
        {errorMsg && (
          <p className="text-red-400 text-sm bg-red-950/30 border border-red-900/50 rounded-dome px-3 py-2">{errorMsg}</p>
        )}
        <button
          onClick={handleCreditsOnly}
          className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-dome transition-colors text-base"
        >
          Confirm Booking — C$0.00
        </button>
      </div>
    );
  }

  // Payment session expired — clientSecret is invalid
  if (peLoadError) {
    return (
      <div className="space-y-4 text-center py-4">
        <p className="text-red-400 font-semibold">⚠️ Payment session expired</p>
        <p className="text-muted text-sm">Your booking hold timed out. Please go back and start a new booking.</p>
        <a href={`/facilities/${facilityId}`} className="inline-block bg-primary hover:bg-primary-hover text-white font-bold px-6 py-3 rounded-dome transition-colors text-sm">
          Back to Facility
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handlePay} className="space-y-5">
      <PaymentElement
        options={{ layout: "tabs" }}
        onReady={() => setPeReady(true)}
        onLoadError={() => setPeLoadError(true)}
      />
      {errorMsg && (
        <p className="text-red-400 text-sm bg-red-950/30 border border-red-900/50 rounded-dome px-3 py-2">{errorMsg}</p>
      )}
      <button
        type="submit"
        disabled={!stripe || !elements || !peReady || paying}
        className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold py-4 rounded-dome transition-colors text-base"
      >
        {!peReady ? "Loading…" : paying ? "Processing…" : `Pay C$${totalCAD.toFixed(2)}`}
      </button>
      <p className="text-center text-xs text-muted">
        🔒 Secured by Stripe · By booking you agree to our cancellation policy.
      </p>
    </form>
  );
}

// ─── Page shell (reads URL params, gates auth, renders Elements wrapper) ──────

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
  const creditsApplied = parseFloat(search.get("creditsApplied") ?? "0");
  const bookingId     = search.get("bookingId") ?? "";
  const groupId       = search.get("groupId") ?? "";

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
  }, [router]);

  const isPaidByCredits = clientSecret === "credits";
  const stripePromise   = getStripe();

  const appearance = {
    theme: "night" as const,
    variables: {
      colorPrimary:    "#E85068",
      colorBackground: "#0a0a0a",
      colorText:       "#ffffff",
      colorDanger:     "#ef4444",
      fontFamily:      "system-ui, sans-serif",
      borderRadius:    "10px",
    },
  };

  return (
    <main className="max-w-lg mx-auto px-4 py-12">
      <div className="mb-6">
        <Link href={`/facilities/${facilityId}`} className="text-sm text-muted hover:text-white transition-colors">
          ← Back to facility
        </Link>
        <h1 className="text-2xl font-black text-white mt-3">Complete Booking</h1>
      </div>

      {/* Summary */}
      <div className="bg-surface border border-border rounded-dome p-5 mb-4">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-4">Booking Summary</h2>
        <Row label="Facility" value={facilityName} />
        {date      && <Row label="Date"   value={formatDisplayDate(date)} />}
        {startTime && <Row label="Time"   value={`${startTime} – ${endTime}`} />}
        {courts    && <Row label="Courts" value={courts} />}
        <div className="border-t border-border mt-4 pt-4 space-y-2">
          <Row label="Subtotal" value={`C$${subtotalCAD.toFixed(2)}`} />
          <Row label="Tax"      value={`C$${taxCAD.toFixed(2)}`} muted />
          {creditsApplied > 0 && (
            <Row label="💳 Credits Applied" value={`−C$${creditsApplied.toFixed(2)}`} muted />
          )}
          <Row label="Total" value={`C$${totalCAD.toFixed(2)}`} highlight />
        </div>
      </div>

      {/* Payment */}
      <div className="bg-surface border border-border rounded-dome p-5 mb-6">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-4">Payment</h2>

        {!clientSecret ? (
          <p className="text-red-400 text-sm">Missing payment info — please go back and try again.</p>
        ) : isPaidByCredits ? (
          <PaymentForm
            bookingId={bookingId} groupId={groupId} facilityId={facilityId}
            facilityName={facilityName} date={date} startTime={startTime}
            endTime={endTime} totalCAD={totalCAD} creditsApplied={creditsApplied}
            clientSecret={clientSecret}
          />
        ) : (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
            <PaymentForm
              bookingId={bookingId} groupId={groupId} facilityId={facilityId}
              facilityName={facilityName} date={date} startTime={startTime}
              endTime={endTime} totalCAD={totalCAD} creditsApplied={creditsApplied}
              clientSecret={clientSecret}
            />
          </Elements>
        )}
      </div>
    </main>
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
