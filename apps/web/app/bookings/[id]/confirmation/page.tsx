"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("en-CA", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

function buildCalendarUrl(params: {
  title: string; date: string; startTime: string; endTime: string; location?: string;
}): string {
  const { title, date, startTime, endTime, location } = params;
  if (!date || !startTime) return "#";
  const [y, m, d] = date.split("-").map(Number);
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = (endTime || startTime).split(":").map(Number);
  const fmt = (y: number, mo: number, da: number, h: number, mi: number) =>
    `${y}${String(mo).padStart(2,"0")}${String(da).padStart(2,"0")}T${String(h).padStart(2,"0")}${String(mi).padStart(2,"0")}00`;
  const start = fmt(y!, m!, d!, sh!, sm!);
  const end   = fmt(y!, m!, d!, eh!, em!);
  const qs = new URLSearchParams({
    action: "TEMPLATE", text: title, dates: `${start}/${end}`,
    ...(location ? { location } : {}),
  });
  return `https://calendar.google.com/calendar/render?${qs}`;
}

export default function ConfirmationPage({ params }: { params: { id: string } }) {
  const search       = useSearchParams();
  const facilityName = search.get("facilityName") ?? "Facility";
  const date         = search.get("date") ?? "";
  const startTime    = search.get("startTime") ?? "";
  const endTime      = search.get("endTime") ?? "";
  const totalCAD     = parseFloat(search.get("totalCAD") ?? "0");

  const calendarUrl = buildCalendarUrl({
    title: `${facilityName} — Dome Booking`,
    date,
    startTime,
    endTime,
    location: facilityName,
  });

  const shareText = encodeURIComponent(`Just booked a court at ${facilityName} on Dome! 🏆`);

  return (
    <main className="max-w-lg mx-auto px-4 py-16 text-center">
      {/* Checkmark */}
      <div className="w-20 h-20 rounded-full bg-green-900/30 border border-green-700 flex items-center justify-center mx-auto mb-6">
        <span className="text-4xl">✅</span>
      </div>

      <h1 className="text-3xl font-black text-white mb-2">Booking Confirmed!</h1>
      <p className="text-muted mb-8">Your court is reserved. See you on the court!</p>

      {/* Details card */}
      <div className="bg-surface border border-border rounded-dome p-6 text-left mb-6">
        <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-4">Booking Details</p>
        <div className="space-y-3">
          <Row label="Booking ID"  value={`#${params.id.slice(0, 8).toUpperCase()}`} mono />
          <Row label="Facility"    value={facilityName} />
          {date      && <Row label="Date"  value={formatDate(date)} />}
          {startTime && <Row label="Time"  value={`${startTime} – ${endTime}`} />}
          {totalCAD  > 0 && <Row label="Total Paid" value={`C$${totalCAD.toFixed(2)}`} highlight />}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-3">
        {calendarUrl !== "#" && (
          <a
            href={calendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-surface border border-border rounded-dome px-5 py-3 text-sm font-semibold text-white hover:border-primary/50 transition-colors"
          >
            📅 Add to Google Calendar
          </a>
        )}

        <div className="flex gap-3">
          <a
            href={`https://twitter.com/intent/tweet?text=${shareText}`}
            target="_blank" rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 bg-surface border border-border rounded-dome px-4 py-3 text-sm font-semibold text-white hover:border-primary/50 transition-colors"
          >
            𝕏 Share
          </a>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent("https://dome.ca")}&quote=${shareText}`}
            target="_blank" rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 bg-surface border border-border rounded-dome px-4 py-3 text-sm font-semibold text-white hover:border-primary/50 transition-colors"
          >
            📘 Share
          </a>
        </div>

        <Link
          href="/bookings"
          className="flex items-center justify-center bg-surface border border-border rounded-dome px-5 py-3 text-sm font-semibold text-muted hover:text-white transition-colors"
        >
          View My Bookings
        </Link>

        <Link
          href="/facilities"
          className="flex items-center justify-center bg-primary hover:bg-primary-hover rounded-dome px-5 py-3 text-sm font-bold text-white transition-colors"
        >
          Book Another Court →
        </Link>
      </div>
    </main>
  );
}

function Row({ label, value, mono, highlight }: {
  label: string; value: string; mono?: boolean; highlight?: boolean;
}) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-sm text-muted shrink-0">{label}</span>
      <span className={`text-sm font-semibold text-right ${mono ? "font-mono" : ""} ${highlight ? "text-primary" : "text-white"}`}>
        {value}
      </span>
    </div>
  );
}
