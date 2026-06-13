import Link from "next/link";
import StatusBadge from "./StatusBadge";
import { getSportEmoji } from "../../lib/cities";
import type { Booking } from "../../lib/api";

interface Props {
  booking: Booking;
  onCancel?: (id: string) => void;
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("T")[0]!.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("en-CA", {
    weekday: "short", month: "short", day: "numeric",
  });
}

export default function BookingCard({ booking, onCancel }: Props) {
  const emoji = getSportEmoji(booking.facility.sport);
  const canCancel = booking.status === "CONFIRMED" || booking.status === "PENDING";

  return (
    <div className="bg-surface border border-border rounded-dome p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{emoji}</span>
          <div>
            <p className="font-bold text-white">{booking.facility.name}</p>
            <p className="text-xs text-muted mt-0.5">
              {booking.slot ? (
                <>
                  {booking.slot.court?.name ? `${booking.slot.court.name} · ` : ""}
                  {formatDate(booking.slot.date)} · {booking.slot.startTime}–{booking.slot.endTime}
                </>
              ) : "Time-based booking"}
            </p>
          </div>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-white">C${booking.totalCAD.toFixed(2)}</p>
        <div className="flex gap-2">
          {canCancel && onCancel && (
            <button
              onClick={() => onCancel(booking.id)}
              className="text-xs text-red-400 hover:text-red-300 transition-colors font-medium"
            >
              Cancel
            </button>
          )}
          <Link
            href={`/facilities/${booking.facility.id}`}
            className="text-xs text-primary hover:underline font-medium"
          >
            Book Again →
          </Link>
        </div>
      </div>
    </div>
  );
}
