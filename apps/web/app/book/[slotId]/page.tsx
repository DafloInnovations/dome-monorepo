"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { API_URL, apiFetch } from "../../../lib/api";
import { getToken, isAuthenticated } from "../../../lib/auth";
import { getStripe } from "../../../lib/stripe";

const TAX_RATE = 0.13;

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

// ─── Stripe payment form (rendered inside Elements after PI created) ──────────

function StripePaymentForm({
  bookingId, clientSecret, totalCAD,
  onSuccess, onError,
}: {
  bookingId: string; clientSecret: string; totalCAD: number;
  onSuccess: (piId: string) => void;
  onError: (msg: string) => void;
}) {
  const stripe   = useStripe();
  const elements = useElements();
  const [busy,  setBusy]  = useState(false);
  const [ready, setReady] = useState(false);

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/bookings/${bookingId}/confirmation`,
      },
      redirect: "if_required",
    });

    if (confirmError) {
      onError(confirmError.message ?? "Payment failed");
      setBusy(false);
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      onSuccess(paymentIntent.id);
    } else {
      onError("Payment was not completed. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handlePay} className="space-y-5">
      <PaymentElement options={{ layout: "tabs" }} onReady={() => setReady(true)} />
      <button
        type="submit"
        disabled={!stripe || !elements || !ready || busy}
        className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold py-4 rounded-dome transition-colors text-base"
      >
        {busy ? "Processing…" : !ready ? "Loading…" : `Pay C$${totalCAD.toFixed(2)}`}
      </button>
      <p className="text-center text-xs text-muted">
        🔒 Secured by Stripe · By booking you agree to our cancellation policy.
      </p>
    </form>
  );
}

// ─── Page content ──────────────────────────────────────────────────────────────

interface BookingResult { id: string; }
interface PaymentIntentResult { clientSecret: string; paymentIntentId: string; totalCAD: number; }

function BookingContent({ slotId }: { slotId: string }) {
  const router = useRouter();
  const search = useSearchParams();

  const facilityId   = search.get("facilityId") ?? "";
  const facilityName = search.get("facilityName") ?? "Facility";
  const startTime    = search.get("startTime") ?? "";
  const endTime      = search.get("endTime") ?? "";
  const priceCAD     = parseFloat(search.get("priceCAD") ?? "0");
  const date         = search.get("date") ?? "";

  const subtotal = priceCAD;
  const tax      = Math.round(subtotal * TAX_RATE * 100) / 100;
  const total    = Math.round((subtotal + tax) * 100) / 100;

  const [playerCount,  setPlayerCount]  = useState(1);
  const [phase,        setPhase]        = useState<"summary" | "creating" | "payment" | "confirming" | "error">("summary");
  const [errorMsg,     setErrorMsg]     = useState("");
  const [bookingId,    setBookingId]    = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [piTotal,      setPiTotal]      = useState(total);

  const pendingBookingIdRef = useRef<string | null>(null);
  const stripePromise = getStripe();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace(`/login?redirect=${encodeURIComponent(`/book/${slotId}${window.location.search}`)}`);
    }
  }, [slotId, router]);

  // Release lock on unmount if user leaves before paying
  useEffect(() => {
    return () => {
      const bid = pendingBookingIdRef.current;
      const tok = getToken();
      if (bid && tok) {
        fetch(`${API_URL}/bookings/${bid}/lock`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${tok}` },
        }).catch(() => {});
      }
    };
  }, []);

  // Step 1+2: create booking + payment intent, then show card form
  async function handleProceedToPayment() {
    setPhase("creating");
    setErrorMsg("");
    try {
      const booking = await apiFetch<{ data: BookingResult }>("/bookings", {
        method: "POST",
        body: JSON.stringify({ slotId, facilityId }),
      });
      pendingBookingIdRef.current = booking.data.id;

      const pi = await apiFetch<{ data: PaymentIntentResult }>("/payments/intent", {
        method: "POST",
        body: JSON.stringify({ bookingId: booking.data.id }),
      });

      setBookingId(booking.data.id);
      setClientSecret(pi.data.clientSecret);
      setPiTotal(pi.data.totalCAD);
      pendingBookingIdRef.current = null; // don't release; user is about to pay
      setPhase("payment");
    } catch (err) {
      const status  = (err as { status?: number }).status;
      const message = err instanceof Error ? err.message : "Something went wrong";
      setErrorMsg(
        status === 409
          ? "This slot was just taken by another player. Please go back and choose a different time."
          : message
      );
      setPhase("error");
    }
  }

  // Step 3: after Stripe confirms, tell our backend
  async function handlePaymentSuccess(paymentIntentId: string) {
    setPhase("confirming");
    try {
      await apiFetch(`/bookings/${bookingId}/confirm`, {
        method: "POST",
        body: JSON.stringify({ paymentIntentId }),
      });
      router.replace(
        `/bookings/${bookingId}/confirmation?facilityName=${encodeURIComponent(facilityName)}&date=${date}&startTime=${startTime}&endTime=${endTime}&totalCAD=${piTotal}`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Booking confirmation failed");
      setPhase("error");
    }
  }

  function handlePaymentError(msg: string) {
    setErrorMsg(msg);
    setPhase("error");
  }

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

  if (phase === "creating" || phase === "confirming") {
    return (
      <main className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white font-semibold">
            {phase === "creating" ? "Reserving your slot…" : "Confirming your booking…"}
          </p>
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

      {/* Booking summary */}
      <div className="bg-surface border border-border rounded-dome p-5 mb-4">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-4">Booking Summary</h2>
        <Row label="Facility" value={facilityName} />
        {date      && <Row label="Date" value={formatDisplayDate(date)} />}
        {startTime && <Row label="Time" value={`${startTime} – ${endTime}`} />}
        <div className="border-t border-border mt-4 pt-4 space-y-2">
          <Row label="Subtotal"  value={`C$${subtotal.toFixed(2)}`} />
          <Row label="HST (13%)" value={`C$${tax.toFixed(2)}`} muted />
          <Row label="Total"     value={`C$${total.toFixed(2)}`} highlight />
        </div>
      </div>

      {/* Player count (only before payment step) */}
      {phase !== "payment" && (
        <div className="bg-surface border border-border rounded-dome p-5 mb-4">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-4">Players</h2>
          <div className="flex items-center gap-6">
            <button
              onClick={() => setPlayerCount((p) => Math.max(1, p - 1))}
              disabled={playerCount <= 1}
              className="w-9 h-9 rounded-full bg-surface-2 border border-border text-white font-bold disabled:opacity-30 hover:border-primary/50 transition-colors"
            >−</button>
            <span className="text-2xl font-bold text-white w-8 text-center">{playerCount}</span>
            <button
              onClick={() => setPlayerCount((p) => Math.min(6, p + 1))}
              disabled={playerCount >= 6}
              className="w-9 h-9 rounded-full bg-surface-2 border border-border text-white font-bold disabled:opacity-30 hover:border-primary/50 transition-colors"
            >+</button>
            <span className="text-xs text-muted ml-2">max 6 players</span>
          </div>
        </div>
      )}

      {/* Payment section */}
      <div className="bg-surface border border-border rounded-dome p-5 mb-6">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-4">Payment</h2>

        {phase === "payment" && clientSecret ? (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
            <StripePaymentForm
              bookingId={bookingId}
              clientSecret={clientSecret}
              totalCAD={piTotal}
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
            />
          </Elements>
        ) : (
          <>
            {phase === "error" && (
              <div className="bg-red-900/30 border border-red-700 rounded-dome px-4 py-3 text-red-400 text-sm mb-4">
                {errorMsg}
              </div>
            )}
            <button
              onClick={handleProceedToPayment}
              className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-dome transition-colors text-base"
            >
              {phase === "error" ? "Try Again" : `Confirm & Pay C$${total.toFixed(2)}`}
            </button>
            <p className="text-center text-xs text-muted mt-3">
              🔒 Secured by Stripe · By booking you agree to our cancellation policy.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

export default function BookingPage({ params }: { params: { slotId: string } }) {
  return (
    <Suspense fallback={
      <main className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </main>
    }>
      <BookingContent slotId={params.slotId} />
    </Suspense>
  );
}
