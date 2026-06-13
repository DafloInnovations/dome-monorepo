"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BookingCard from "../../components/ui/BookingCard";
import Modal from "../../components/ui/Modal";
import { apiFetch, type Booking } from "../../lib/api";
import { isAuthenticated } from "../../lib/auth";

export default function BookingsPage() {
  const router = useRouter();
  const [bookings, setBookings]   = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState("");
  const [tab, setTab]             = useState<"upcoming" | "past">("upcoming");
  const [cancelId, setCancelId]   = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login?redirect=/bookings");
      return;
    }
    apiFetch<{ data: Booking[]; total: number }>("/bookings/me?limit=100")
      .then((r) => setBookings(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setIsLoading(false));
  }, [router]);

  async function handleCancel() {
    if (!cancelId) return;
    setCancelling(true);
    try {
      await apiFetch(`/bookings/${cancelId}/cancel`, {
        method: "PUT",
        body: JSON.stringify({ reason: "Cancelled by player" }),
      });
      setBookings((prev) =>
        prev.map((b) => b.id === cancelId ? { ...b, status: "CANCELLED" } : b)
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setCancelling(false);
      setCancelId(null);
    }
  }

  const now = new Date();

  const upcoming = bookings.filter((b) => {
    if (b.status === "CANCELLED") return false;
    if (!b.slot) return true;
    const dateStr = b.slot.date.split("T")[0]!;
    const slotEnd = new Date(`${dateStr}T${b.slot.endTime}:00`);
    return slotEnd >= now;
  });

  const past = bookings.filter((b) => {
    if (b.status === "CANCELLED") return true;
    if (!b.slot) return false;
    const dateStr = b.slot.date.split("T")[0]!;
    const slotEnd = new Date(`${dateStr}T${b.slot.endTime}:00`);
    return slotEnd < now;
  });

  const displayed = tab === "upcoming" ? upcoming : past;
  const cancelTarget = bookings.find((b) => b.id === cancelId);

  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-2xl md:text-3xl font-black text-white mb-6">My Bookings</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface border border-border rounded-dome p-1 w-fit mb-6">
        {(["upcoming", "past"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-[10px] text-sm font-semibold capitalize transition-colors ${
              tab === t ? "bg-primary text-white" : "text-muted hover:text-white"
            }`}
          >
            {t} {t === "upcoming" ? `(${upcoming.length})` : `(${past.length})`}
          </button>
        ))}
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface border border-border rounded-dome h-24 animate-pulse" />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-5xl mb-4">{tab === "upcoming" ? "📅" : "🏆"}</p>
          <p className="text-lg font-bold text-white mb-2">
            {tab === "upcoming" ? "No upcoming bookings" : "No past bookings"}
          </p>
          <p className="text-muted text-sm mb-6">
            {tab === "upcoming" ? "Book a court to get started." : "Your played sessions will appear here."}
          </p>
          <a href="/facilities" className="bg-primary hover:bg-primary-hover text-white font-bold px-6 py-3 rounded-dome transition-colors text-sm">
            Find a Court
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              onCancel={tab === "upcoming" ? (id) => setCancelId(id) : undefined}
            />
          ))}
        </div>
      )}

      <Modal
        open={!!cancelId}
        title="Cancel Booking"
        description={
          cancelTarget
            ? `Cancel your booking${cancelTarget.slot ? ` on ${new Date(cancelTarget.slot.date.split("T")[0]! + "T00:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric" })} at ${cancelTarget.slot.startTime}` : ""}? You may be eligible for a refund depending on timing.`
            : ""
        }
        confirmLabel="Yes, Cancel"
        cancelLabel="Keep Booking"
        destructive
        isLoading={cancelling}
        onConfirm={handleCancel}
        onCancel={() => setCancelId(null)}
      />
    </main>
  );
}
