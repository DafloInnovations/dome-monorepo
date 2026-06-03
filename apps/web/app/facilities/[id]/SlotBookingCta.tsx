"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL, apiFetch } from "../../../lib/api";
import { getStoredUser } from "../../../lib/auth";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DURATION_OPTS = [30, 60, 90, 120, 180] as const;
type Duration = (typeof DURATION_OPTS)[number];

interface PriceBreakdown {
  basePriceCAD: number;
  appliedRule: string | null;
  finalPriceCAD: number;
}

interface AvailableCourt {
  id: string;
  name: string;
  unitLabel: string;
  sport: string;
  surface: string;
  totalPriceCAD: number;
  basePriceCAD: number;
  priceBreakdown: PriceBreakdown | null;
  isAvailable: boolean;
  notCovered: boolean;
  slots: string[];
  bookedUntil: string | null;
}

interface AvailableCourtsResult {
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  courts: AvailableCourt[];
}

const SPORT_EMOJI: Record<string, string> = {
  SOCCER: "⚽", BASKETBALL: "🏀", TENNIS: "🎾", BADMINTON: "🏸",
  VOLLEYBALL: "🏐", HOCKEY: "🏒", SQUASH: "🎾", PICKLEBALL: "🏓",
};

function getNext7Days(): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addMins(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h! * 60 + m! + mins;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function formatAmPm(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h! >= 12 ? "PM" : "AM";
  const hour = h! % 12 || 12;
  return `${hour}:${String(m!).padStart(2, "0")} ${period}`;
}

// Generate times every 30 min 06:00–22:30
function buildTimeslots(): string[] {
  const times: string[] = [];
  for (let h = 6; h < 23; h++) {
    times.push(`${String(h).padStart(2, "0")}:00`);
    times.push(`${String(h).padStart(2, "0")}:30`);
  }
  return times;
}
const ALL_TIMES = buildTimeslots();

interface Props {
  facilityId: string;
  facilityName: string;
}

export default function SlotBookingCta({ facilityId, facilityName }: Props) {
  const router = useRouter();
  const days = getNext7Days();

  const [dayIdx, setDayIdx] = useState(0);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [duration, setDuration] = useState<Duration>(60);
  const [courtsResult, setCourtsResult] = useState<AvailableCourtsResult | null>(null);
  const [courtsLoading, setCourtsLoading] = useState(false);
  const [selectedCourts, setSelectedCourts] = useState<AvailableCourt[]>([]);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [alertSet, setAlertSet] = useState(false);
  const [alertLoading, setAlertLoading] = useState(false);

  // Recurring state
  const [recurringOn, setRecurringOn] = useState(false);
  const [recurringFreq, setRecurringFreq] = useState<"WEEKLY" | "BIWEEKLY">("WEEKLY");
  const [recurringWeeks, setRecurringWeeks] = useState(8);
  const [recurringPayModel, setRecurringPayModel] = useState<"PAY_PER_SESSION" | "PAY_UPFRONT">("PAY_PER_SESSION");

  const date = formatDate(days[dayIdx]!);
  const endTime = startTime ? addMins(startTime, duration) : null;

  // Fetch available courts whenever date/time/duration changes
  useEffect(() => {
    setAlertSet(false);
    if (!startTime) { setCourtsResult(null); setSelectedCourts([]); return; }
    setCourtsLoading(true);
    setSelectedCourts([]);
    const qs = new URLSearchParams({ date, startTime, duration: String(duration) });
    fetch(`${API_URL}/facilities/${facilityId}/available-courts?${qs}`)
      .then((r) => r.json())
      .then((json: { data: AvailableCourtsResult }) => setCourtsResult(json.data))
      .catch(() => setCourtsResult(null))
      .finally(() => setCourtsLoading(false));
  }, [facilityId, date, startTime, duration]);

  function toggleCourt(court: AvailableCourt) {
    if (!court.isAvailable) return;
    setSelectedCourts((prev) =>
      prev.find((c) => c.id === court.id)
        ? prev.filter((c) => c.id !== court.id)
        : [...prev, court]
    );
  }

  async function handleBook() {
    if (!selectedCourts.length || !startTime) return;
    const user = getStoredUser();
    if (!user) { router.push("/profile"); return; }

    setBookingLoading(true);
    setBookingError("");
    try {
      const slotIds = selectedCourts.flatMap((c) => c.slots);
      const result = await apiFetch<{
        data: { type: string; bookingId: string | null; groupId: string | null; clientSecret: string; totalCAD: number };
      }>("/bookings/time-based", {
        method: "POST",
        body: JSON.stringify({ slotIds, facilityId }),
      });

      const { type, bookingId, groupId, clientSecret, totalCAD } = result.data;
      const courtNames = selectedCourts.map((c) => c.name).join(", ");
      const params = new URLSearchParams({
        facilityId,
        facilityName,
        date,
        startTime,
        endTime: endTime!,
        durationMinutes: String(duration),
        courts: courtNames,
        clientSecret,
        totalCAD: String(totalCAD),
        ...(type === "single" && bookingId ? { bookingId } : {}),
        ...(type === "group" && groupId ? { groupId } : {}),
      });
      router.push(`/book/time-based?${params}`);
    } catch (e) {
      setBookingError(e instanceof Error ? e.message : "Booking failed. Please try again.");
    } finally {
      setBookingLoading(false);
    }
  }

  async function handleSetAlert() {
    if (!startTime || !endTime) return;
    const user = getStoredUser();
    if (!user) { router.push("/profile"); return; }
    setAlertLoading(true);
    try {
      await apiFetch("/alerts", {
        method: "POST",
        body: JSON.stringify({
          facilityId,
          courtId: null,
          date,
          startTime,
          endTime,
          durationMinutes: duration,
        }),
      });
      setAlertSet(true);
    } catch (e) {
      setBookingError(e instanceof Error ? e.message : "Failed to set alert");
    } finally {
      setAlertLoading(false);
    }
  }

  const totalPrice = selectedCourts.reduce((s, c) => s + c.totalPriceCAD, 0);
  const canBook = selectedCourts.length > 0 && !!startTime;

  // Recurring helpers
  function getRecurringDiscount(): number {
    if (recurringPayModel !== "PAY_UPFRONT") return 0;
    if (recurringWeeks >= 12) return 15;
    if (recurringWeeks >= 8) return 10;
    if (recurringWeeks >= 4) return 5;
    return 0;
  }
  const recurringSubtotal = totalPrice * recurringWeeks;
  const recurringDisc = getRecurringDiscount();
  const recurringSaved = Math.round(recurringSubtotal * (recurringDisc / 100) * 100) / 100;
  const recurringTotal = recurringSubtotal - recurringSaved;

  return (
    <div className="space-y-5">
      {/* Step 1: Date */}
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white text-[10px] font-black mr-2">1</span>
          Pick a Date
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {days.map((day, i) => (
            <button
              key={i}
              onClick={() => { setDayIdx(i); setStartTime(null); }}
              className={`flex flex-col items-center min-w-[52px] py-3 rounded-dome border transition-colors ${
                dayIdx === i
                  ? "bg-primary border-primary text-white"
                  : "bg-surface border-border text-muted hover:text-white"
              }`}
            >
              <span className="text-[10px] font-semibold uppercase">{DAY_LABELS[day.getDay()]}</span>
              <span className="text-lg font-bold mt-0.5">{day.getDate()}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: Time + Duration */}
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white text-[10px] font-black mr-2">2</span>
          Start Time & Duration
        </p>
        <div className="flex gap-3 items-center flex-wrap">
          {/* Time dropdown */}
          <select
            value={startTime ?? ""}
            onChange={(e) => setStartTime(e.target.value || null)}
            className="bg-surface border border-border rounded-dome px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
          >
            <option value="">Select time…</option>
            {ALL_TIMES.map((t) => (
              <option key={t} value={t}>{formatAmPm(t)}</option>
            ))}
          </select>

          {/* Duration pills */}
          <div className="flex gap-2 flex-wrap">
            {DURATION_OPTS.map((d) => {
              const h = Math.floor(d / 60);
              const m = d % 60;
              const label = h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
              return (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`px-3 py-1.5 text-sm font-semibold rounded-dome border transition-colors ${
                    duration === d
                      ? "bg-primary border-primary text-white"
                      : "border-border text-muted hover:text-white hover:border-primary/50"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* End time display */}
          {startTime && endTime && (
            <span className="text-sm text-muted">→ {formatAmPm(endTime)}</span>
          )}
        </div>
      </div>

      {/* Step 3: Courts */}
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white text-[10px] font-black mr-2">3</span>
          Available Courts
        </p>

        {!startTime ? (
          <p className="text-sm text-muted py-4 text-center">Select a time to see available courts</p>
        ) : courtsLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-28 bg-surface rounded-dome border border-border animate-pulse" />
            ))}
          </div>
        ) : !courtsResult || courtsResult.courts.length === 0 ? (
          <p className="text-sm text-muted py-4 text-center">No courts configured for this facility</p>
        ) : (
          <>
            {/* Pricing notice */}
            {(() => {
              const courts = courtsResult.courts.filter((c) => c.isAvailable && c.priceBreakdown?.appliedRule);
              const rules = [...new Set(courts.map((c) => c.priceBreakdown!.appliedRule))].filter(Boolean);
              if (!rules.length) return null;
              return (
                <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-dome bg-amber-900/20 border border-amber-900/40 text-amber-400 text-xs font-semibold">
                  <span>⚡</span>
                  <span>{rules.join(" · ")}</span>
                </div>
              );
            })()}

            {/* All-booked alert banner */}
            {courtsResult.courts.every((c) => !c.isAvailable) && startTime && (
              <div className="mb-3 p-4 rounded-dome border border-primary/30 bg-primary/[0.06] flex flex-col gap-3">
                <div>
                  <p className="text-sm font-bold text-white">All courts are booked for this time</p>
                  <p className="text-xs text-muted mt-0.5">
                    Get notified by push &amp; SMS the moment a court opens up.
                  </p>
                </div>
                <button
                  onClick={handleSetAlert}
                  disabled={alertSet || alertLoading}
                  className={`self-start px-4 py-2 rounded-dome text-sm font-bold transition-colors ${
                    alertSet
                      ? "bg-green-900/40 text-green-400 cursor-default"
                      : "bg-primary hover:bg-primary-hover text-white disabled:opacity-50"
                  }`}
                >
                  {alertLoading
                    ? "Setting alert…"
                    : alertSet
                    ? "✓ We'll notify you by SMS when a court opens up"
                    : "🔔 Set Availability Alert"}
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {courtsResult.courts.map((court) => {
                const isSelected = selectedCourts.some((c) => c.id === court.id);
                const emoji = SPORT_EMOJI[court.sport?.toUpperCase() ?? ""] ?? "🏟️";
                const bd = court.priceBreakdown;
                const hasPriceChange = bd !== null && bd.finalPriceCAD !== bd.basePriceCAD;
                const isDiscount = hasPriceChange && bd!.finalPriceCAD < bd!.basePriceCAD;
                const isPremium  = hasPriceChange && bd!.finalPriceCAD > bd!.basePriceCAD;
                const discountPct = isDiscount ? Math.round((1 - bd!.finalPriceCAD / bd!.basePriceCAD) * 100) : null;

                return (
                  <button
                    key={court.id}
                    onClick={() => toggleCourt(court)}
                    disabled={!court.isAvailable}
                    className={`relative flex flex-col items-center gap-1.5 p-4 rounded-dome border-2 text-center transition-colors ${
                      !court.isAvailable
                        ? "opacity-45 cursor-not-allowed border-border bg-surface"
                        : isSelected
                        ? "border-primary bg-primary/[0.08]"
                        : "border-border bg-surface hover:border-primary/50"
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary text-white text-[11px] flex items-center justify-center font-bold">✓</span>
                    )}
                    {court.isAvailable && isDiscount && (
                      <span className="absolute top-2 left-2 text-[10px] font-black px-1.5 py-0.5 rounded bg-green-900/70 text-green-300">
                        {discountPct}% OFF
                      </span>
                    )}
                    {court.isAvailable && isPremium && (
                      <span className="absolute top-2 left-2 text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-900/70 text-amber-300">Peak</span>
                    )}
                    <span className="text-2xl mt-1">{emoji}</span>
                    <span className={`text-sm font-bold ${court.isAvailable ? "text-white" : "text-muted"}`}>
                      {court.name}
                    </span>
                    {court.isAvailable ? (
                      <div className="flex flex-col items-center gap-0.5">
                        {hasPriceChange && bd && (
                          <span className="text-muted text-xs line-through">C${bd.basePriceCAD.toFixed(2)}</span>
                        )}
                        <span className={`font-bold text-sm ${isDiscount ? "text-green-400" : isPremium ? "text-amber-400" : "text-primary"}`}>
                          C${court.totalPriceCAD.toFixed(2)}
                        </span>
                        {bd?.appliedRule && (
                          <span className="text-muted text-[10px] truncate max-w-full">{bd.appliedRule}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted text-xs">
                        {court.notCovered ? "No slots for window" : court.bookedUntil ? `Booked until ${court.bookedUntil}` : "Unavailable"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Error */}
      {bookingError && (
        <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-dome px-3 py-2">
          {bookingError}
        </p>
      )}

      {/* Recurring toggle */}
      {canBook && (
        <div className="bg-surface border border-border rounded-dome p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white">🔄 Make it recurring</span>
            <button
              onClick={() => setRecurringOn((v) => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors ${recurringOn ? "bg-primary" : "bg-border"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${recurringOn ? "translate-x-5" : ""}`} />
            </button>
          </div>

          {recurringOn && (
            <div className="space-y-3 pt-1">
              {/* Frequency */}
              <div>
                <p className="text-xs text-muted uppercase tracking-wide mb-2">Repeat every</p>
                <div className="flex gap-2">
                  {(["WEEKLY", "BIWEEKLY"] as const).map((f) => (
                    <button key={f} onClick={() => setRecurringFreq(f)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-dome border transition-colors ${recurringFreq === f ? "bg-primary border-primary text-white" : "border-border text-muted hover:text-white"}`}>
                      {f === "WEEKLY" ? "Weekly" : "Biweekly"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div>
                <p className="text-xs text-muted uppercase tracking-wide mb-2">For how long</p>
                <div className="flex gap-2">
                  {[4, 8, 12].map((w) => {
                    const d = w >= 12 ? 15 : w >= 8 ? 10 : 5;
                    return (
                      <button key={w} onClick={() => setRecurringWeeks(w)}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-dome border transition-colors ${recurringWeeks === w ? "bg-primary border-primary text-white" : "border-border text-muted hover:text-white"}`}>
                        {w}wks{d > 0 ? ` (${d}% off)` : ""}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Payment model */}
              <div className="flex flex-col gap-2">
                {(["PAY_PER_SESSION", "PAY_UPFRONT"] as const).map((p) => {
                  const disc = p === "PAY_UPFRONT" ? getRecurringDiscount() : 0;
                  return (
                    <button key={p} onClick={() => setRecurringPayModel(p)}
                      className={`flex items-center gap-3 p-3 rounded-dome border text-left transition-colors ${recurringPayModel === p ? "border-primary bg-primary/[0.07]" : "border-border"}`}>
                      <span className={`w-3.5 h-3.5 rounded-full border-2 ${recurringPayModel === p ? "border-primary bg-primary" : "border-muted"}`} />
                      <div>
                        <p className="text-sm text-white font-semibold">
                          {p === "PAY_PER_SESSION" ? "Pay per session" : `Pay upfront${disc > 0 ? ` — save ${disc}% 💰` : ""}`}
                        </p>
                        {p === "PAY_UPFRONT" && disc > 0 && (
                          <p className="text-xs text-muted">Commit & save C${recurringSaved.toFixed(2)}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Preview */}
              <div className="bg-black rounded-dome px-4 py-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted">{recurringWeeks} sessions × C${totalPrice.toFixed(2)}</span>
                  <span className="text-white">C${recurringSubtotal.toFixed(2)}</span>
                </div>
                {recurringSaved > 0 && (
                  <div className="flex justify-between">
                    <span className="text-green-400">Discount ({recurringDisc}%)</span>
                    <span className="text-green-400">−C${recurringSaved.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t border-border pt-1 mt-1">
                  <span className="text-white">{recurringPayModel === "PAY_UPFRONT" ? "Total upfront" : "First session"}</span>
                  <span className="text-primary">{recurringPayModel === "PAY_UPFRONT" ? `C$${recurringTotal.toFixed(2)}` : `C$${totalPrice.toFixed(2)}`}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CTA */}
      {canBook && (
        <div className="border-t border-border pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted">
              {selectedCourts.length} court{selectedCourts.length !== 1 ? "s" : ""} ·{" "}
              {startTime ? formatAmPm(startTime) : ""} – {endTime ? formatAmPm(endTime) : ""}
            </span>
            <span className="text-primary font-bold">{recurringOn ? `C$${recurringPayModel === "PAY_UPFRONT" ? recurringTotal.toFixed(2) : totalPrice.toFixed(2)}` : `C$${totalPrice.toFixed(2)}`}</span>
          </div>
          <button
            onClick={handleBook}
            disabled={bookingLoading}
            className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold py-3 rounded-dome transition-colors text-sm"
          >
            {bookingLoading
              ? "Reserving…"
              : recurringOn
              ? `🔄 Subscribe & Save — ${recurringPayModel === "PAY_UPFRONT" ? `C$${recurringTotal.toFixed(2)}` : `C$${totalPrice.toFixed(2)}/session`}`
              : `Book ${selectedCourts.length} Court${selectedCourts.length !== 1 ? "s" : ""} — C$${totalPrice.toFixed(2)}`}
          </button>
          <p className="text-xs text-muted text-center">
            {recurringOn && recurringPayModel === "PAY_PER_SESSION"
              ? "First session charged now · Future sessions auto-billed weekly"
              : recurringOn
              ? "All sessions charged upfront · Cancel anytime for prorated refund"
              : "Tax calculated at checkout · Courts held for 5 minutes"}
          </p>
        </div>
      )}
    </div>
  );
}
