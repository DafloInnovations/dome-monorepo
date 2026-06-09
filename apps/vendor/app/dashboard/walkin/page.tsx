"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import confetti from "canvas-confetti";
import Header from "../../../components/layout/Header";
import { api, type Facility, type WalkinCreated, type WalkinHistory, type WalkinPrice } from "../../../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type PanelState = "idle" | "loading" | "waiting" | "paid" | "expired";

const DURATION_OPTS = [
  { label: "30m", value: 30 },
  { label: "1h",  value: 60 },
  { label: "1.5h", value: 90 },
  { label: "2h",  value: 120 },
  { label: "3h",  value: 180 },
];

function todayStr() {
  return new Date().toISOString().split("T")[0]!;
}

function addMins(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h! * 60 + m! + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function fmtTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ampm = h! >= 12 ? "PM" : "AM";
  const h12 = h! % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function sportEmoji(sport: string): string {
  const s = sport.toUpperCase();
  if (s === "BADMINTON")   return "🏸";
  if (s === "TENNIS")      return "🎾";
  if (s === "PICKLEBALL")  return "🥒";
  if (s === "BASKETBALL")  return "🏀";
  if (s === "SOCCER")      return "⚽";
  if (s === "VOLLEYBALL")  return "🏐";
  if (s === "SQUASH")      return "🎱";
  if (s === "HOCKEY")      return "🏒";
  if (s === "CRICKET")     return "🏏";
  if (s === "BASEBALL")    return "⚾";
  return "🏅";
}

function sportLabel(sport: string): string {
  return sport.charAt(0).toUpperCase() + sport.slice(1).toLowerCase();
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WalkinPage() {
  // Form state
  const [facilityId, setFacilityId] = useState("");
  const [courtId, setCourtId] = useState("");
  const [date, setDate] = useState(todayStr());
  const [startTime, setStartTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [sport, setSport] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [playerPhone, setPlayerPhone] = useState("");

  // Data
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [pricing, setPricing] = useState<WalkinPrice | null>(null);
  const [history, setHistory] = useState<WalkinHistory | null>(null);
  const [loadingFacilities, setLoadingFacilities] = useState(true);
  const [formError, setFormError] = useState("");
  const [generating, setGenerating] = useState(false);

  // QR panel
  const [panelState, setPanelState] = useState<PanelState>("idle");
  const [activeBooking, setActiveBooking] = useState<WalkinCreated | null>(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const pricingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  // ─── Derived values ─────────────────────────────────────────────────────────

  const selectedFacility = facilities.find((f) => f.id === facilityId) ?? null;
  const activeCourts = selectedFacility?.courts.filter((c) => c.isActive) ?? [];
  const selectedCourt = activeCourts.find((c) => c.id === courtId) ?? null;
  const availableSports: string[] = selectedCourt?.sports?.length
    ? selectedCourt.sports
    : selectedFacility
    ? [selectedFacility.sport]
    : [];

  // When facility changes, reset court + sport
  useEffect(() => {
    setCourtId("");
    setSport("");
  }, [facilityId]);

  // When court changes, reset sport
  useEffect(() => {
    setSport("");
  }, [courtId]);

  // Auto-set sport when only one option
  useEffect(() => {
    if (availableSports.length === 1 && sport !== availableSports[0]) {
      setSport(availableSports[0]!);
    }
  }, [availableSports, sport]);

  // ─── Load facilities ─────────────────────────────────────────────────────────

  useEffect(() => {
    api.vendor.facilities()
      .then((r) => {
        setFacilities(r.data.filter((f) => f.isActive));
        if (r.data.length === 1) setFacilityId(r.data[0]!.id);
      })
      .catch(() => setFormError("Failed to load facilities"))
      .finally(() => setLoadingFacilities(false));
  }, []);

  // ─── Load today's history ─────────────────────────────────────────────────

  const loadHistory = useCallback(() => {
    api.walkin.history()
      .then((r) => setHistory(r.data))
      .catch(() => null);
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // ─── Pricing preview (debounced) ──────────────────────────────────────────

  useEffect(() => {
    if (!courtId || !date || !startTime || !durationMinutes || !sport) {
      setPricing(null);
      return;
    }

    if (pricingTimerRef.current) clearTimeout(pricingTimerRef.current);
    pricingTimerRef.current = setTimeout(() => {
      api.walkin.price({ courtId, date, startTime, durationMinutes, sport })
        .then((r) => setPricing(r.data))
        .catch(() => setPricing(null));
    }, 400);

    return () => {
      if (pricingTimerRef.current) clearTimeout(pricingTimerRef.current);
    };
  }, [courtId, date, startTime, durationMinutes, sport]);

  // ─── Countdown timer ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!activeBooking || panelState !== "waiting") return;
    const expiresAt = new Date(activeBooking.expiresAt).getTime();

    const interval = setInterval(() => {
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        setPanelState("expired");
        clearInterval(interval);
        return;
      }
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setTimeLeft(`${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeBooking, panelState]);

  // ─── Poll for payment ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!activeBooking || panelState !== "waiting") return;

    const poll = setInterval(async () => {
      try {
        const res = await api.walkin.status(activeBooking.bookingId);
        if (res.data.status === "PAID") {
          setPanelState("paid");
          clearInterval(poll);
          setIsFullscreen(false);
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
          loadHistory();
        }
      } catch {
        // ignore poll errors
      }
    }, 2000);

    return () => clearInterval(poll);
  }, [activeBooking, panelState, loadHistory]);

  // ─── Generate QR ─────────────────────────────────────────────────────────

  async function handleGenerate() {
    if (!courtId || !facilityId || !date || !startTime || !sport) {
      setFormError("Please fill in all required fields");
      return;
    }
    setFormError("");
    setGenerating(true);
    try {
      const res = await api.walkin.create({
        courtId,
        facilityId,
        date,
        startTime,
        durationMinutes,
        sport,
        playerName: playerName || undefined,
        playerPhone: playerPhone || undefined,
      });
      setActiveBooking(res.data);
      setPanelState("waiting");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to generate QR code");
    } finally {
      setGenerating(false);
    }
  }

  function handleNewBooking() {
    setActiveBooking(null);
    setPanelState("idle");
    setPlayerName("");
    setPlayerPhone("");
    setStartTime("");
    setDate(todayStr());
  }

  function handlePrint() {
    window.print();
  }

  // ─── Available times (every 30 min, 6am–11pm) ─────────────────────────────

  const timeOptions: string[] = [];
  for (let h = 6; h < 23; h++) {
    timeOptions.push(`${String(h).padStart(2, "0")}:00`);
    timeOptions.push(`${String(h).padStart(2, "0")}:30`);
  }

  // ─── Fullscreen QR view ───────────────────────────────────────────────────

  if (isFullscreen && activeBooking && panelState === "waiting") {
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-50 p-8">
        <button
          onClick={() => setIsFullscreen(false)}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-sm font-medium"
        >
          ✕ Exit Fullscreen
        </button>

        <p className="text-gray-500 text-sm font-semibold tracking-widest uppercase mb-6">
          Scan to Pay
        </p>

        {/* QR Code */}
        <div className="border-4 border-gray-100 rounded-2xl p-4 mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activeBooking.qrCodeDataUrl}
            alt="Payment QR code"
            className="w-72 h-72"
          />
        </div>

        {/* Amount */}
        <div className="bg-gray-50 rounded-2xl px-10 py-5 mb-4 text-center">
          <p className="text-gray-500 text-sm mb-1">Total Due</p>
          <p className="text-5xl font-black text-gray-900">
            C${activeBooking.totalCAD.toFixed(2)}
          </p>
        </div>

        <p className="text-gray-400 text-sm text-center">
          {sportEmoji(activeBooking.sport)} {sportLabel(activeBooking.sport)} · {activeBooking.courtName}
          <br />
          {activeBooking.date} · {fmtTime(activeBooking.startTime)}–{fmtTime(activeBooking.endTime)}
        </p>

        <p className="mt-4 text-gray-400 text-xs">
          Apple Pay · Google Pay · Card · Expires in {timeLeft}
        </p>
      </div>
    );
  }

  // ─── Print styles ─────────────────────────────────────────────────────────

  const printStyles = activeBooking ? `
    @media print {
      body * { visibility: hidden !important; }
      #print-receipt, #print-receipt * { visibility: visible !important; }
      #print-receipt { position: fixed; top: 0; left: 0; width: 100%; }
    }
  ` : "";

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {printStyles && <style dangerouslySetInnerHTML={{ __html: printStyles }} />}

      {/* Hidden print receipt */}
      {activeBooking && (
        <div id="print-receipt" className="hidden print:block p-8 max-w-sm mx-auto">
          <div className="text-center mb-6">
            <p className="text-2xl font-black">Dome</p>
            <p className="text-sm text-gray-500">{activeBooking.facilityName}</p>
          </div>
          <div className="border-t border-b border-gray-200 py-4 mb-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Sport</span>
              <span>{sportLabel(activeBooking.sport)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Court</span>
              <span>{activeBooking.courtName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Date</span>
              <span>{activeBooking.date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Time</span>
              <span>{fmtTime(activeBooking.startTime)}–{fmtTime(activeBooking.endTime)}</span>
            </div>
            <div className="flex justify-between font-bold text-base pt-2">
              <span>Total Paid</span>
              <span>C${activeBooking.totalCAD.toFixed(2)}</span>
            </div>
          </div>
          <p className="text-center text-gray-500 text-xs">Thank you for playing!</p>
        </div>
      )}

      <Header title="Walk-in POS" />

      <main className="flex-1 p-6 overflow-auto space-y-6">
        <div className="flex gap-6 items-start">

          {/* ── LEFT: Booking Form ── */}
          <div className="w-[420px] shrink-0 bg-surface border border-border rounded-dome p-6 space-y-5">
            <p className="text-xs font-bold text-muted tracking-widest uppercase">New Walk-in Booking</p>

            {formError && (
              <div className="bg-red-900/30 border border-red-700 rounded-dome px-3 py-2 text-sm text-red-300">
                {formError}
              </div>
            )}

            {/* Facility */}
            {!loadingFacilities && facilities.length > 1 && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted uppercase tracking-wider">Facility</label>
                <select
                  value={facilityId}
                  onChange={(e) => setFacilityId(e.target.value)}
                  className="w-full bg-black border border-border rounded-dome px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                >
                  <option value="">Select facility</option>
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Court */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted uppercase tracking-wider">Court *</label>
              <select
                value={courtId}
                onChange={(e) => setCourtId(e.target.value)}
                disabled={!facilityId}
                className="w-full bg-black border border-border rounded-dome px-3 py-2 text-sm text-white focus:outline-none focus:border-primary disabled:opacity-40"
              >
                <option value="">Select court</option>
                {activeCourts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted uppercase tracking-wider">Date *</label>
              <div className="relative">
                <input
                  ref={dateRef}
                  type="date"
                  value={date}
                  min={todayStr()}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-black border border-border rounded-dome pl-3 pr-10 py-2 text-sm text-white focus:outline-none focus:border-primary [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:hidden"
                />
                <button
                  type="button"
                  onClick={() => dateRef.current?.showPicker?.()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-white transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 2v4M16 2v4" />
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path d="M3 10h18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Start Time */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted uppercase tracking-wider">Start Time *</label>
              <select
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-black border border-border rounded-dome px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
              >
                <option value="">Select time</option>
                {timeOptions.map((t) => (
                  <option key={t} value={t}>{fmtTime(t)}</option>
                ))}
              </select>
            </div>

            {/* Duration */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted uppercase tracking-wider">Duration *</label>
              <div className="flex gap-2">
                {DURATION_OPTS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setDurationMinutes(d.value)}
                    className={`flex-1 py-2 text-xs font-semibold rounded-dome transition-colors ${
                      durationMinutes === d.value
                        ? "bg-primary text-white"
                        : "bg-black border border-border text-muted hover:text-white hover:border-white/30"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sport */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted uppercase tracking-wider">Sport *</label>
              <select
                value={sport}
                onChange={(e) => setSport(e.target.value)}
                disabled={availableSports.length === 0}
                className="w-full bg-black border border-border rounded-dome px-3 py-2 text-sm text-white focus:outline-none focus:border-primary disabled:opacity-40"
              >
                <option value="">Select sport</option>
                {availableSports.map((s) => (
                  <option key={s} value={s}>
                    {sportEmoji(s)} {sportLabel(s)}
                  </option>
                ))}
              </select>
            </div>

            {/* Player Info */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">Player Info (optional)</p>
              <input
                type="text"
                placeholder="Name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full bg-black border border-border rounded-dome px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-primary"
              />
              <input
                type="tel"
                placeholder="+1 (for SMS receipt)"
                value={playerPhone}
                onChange={(e) => setPlayerPhone(e.target.value)}
                className="w-full bg-black border border-border rounded-dome px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-primary"
              />
            </div>

            {/* Pricing summary */}
            {pricing && (
              <div className="border-t border-border pt-4 space-y-1.5 text-sm">
                <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Pricing Summary</p>
                <div className="flex justify-between text-muted">
                  <span>
                    {sportLabel(sport)} ({durationMinutes >= 60 ? `${durationMinutes / 60}h` : `${durationMinutes}m`})
                  </span>
                  <span>C${pricing.basePriceCAD.toFixed(2)}</span>
                </div>
                {pricing.appliedRule && (
                  <div className="flex justify-between text-primary text-xs">
                    <span>{pricing.appliedRule}</span>
                    <span>C${(pricing.subtotalCAD - pricing.basePriceCAD).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted">
                  <span>Subtotal</span>
                  <span>C${pricing.subtotalCAD.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>Tax ({Math.round(pricing.taxRate * 100)}%)</span>
                  <span>C${pricing.taxCAD.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-white border-t border-border pt-2 mt-1">
                  <span>Total</span>
                  <span>C${pricing.totalCAD.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={generating || !courtId || !date || !startTime || !sport}
              className="w-full bg-primary hover:bg-primary-hover disabled:opacity-40 text-white font-semibold py-3 rounded-dome transition-colors flex items-center justify-center gap-2"
            >
              {generating ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>🔳</span>
                  Generate QR Code
                </>
              )}
            </button>
          </div>

          {/* ── RIGHT: QR Panel ── */}
          <div className="flex-1 min-w-0">
            <QRPanel
              state={panelState}
              booking={activeBooking}
              timeLeft={timeLeft}
              onFullscreen={() => setIsFullscreen(true)}
              onNewBooking={handleNewBooking}
              onPrint={handlePrint}
            />
          </div>
        </div>

        {/* ── Today's Walk-in Summary ── */}
        {history && (
          <TodaysSummary history={history} />
        )}
      </main>
    </>
  );
}

// ─── QR Panel ─────────────────────────────────────────────────────────────────

function QRPanel({
  state,
  booking,
  timeLeft,
  onFullscreen,
  onNewBooking,
  onPrint,
}: {
  state: PanelState;
  booking: WalkinCreated | null;
  timeLeft: string;
  onFullscreen: () => void;
  onNewBooking: () => void;
  onPrint: () => void;
}) {
  if (state === "idle") {
    return (
      <div className="bg-surface border border-border rounded-dome p-10 flex flex-col items-center justify-center text-center min-h-[480px]">
        <div className="text-6xl mb-4 opacity-30">🔳</div>
        <p className="text-white font-semibold mb-1">Fill in booking details</p>
        <p className="text-muted text-sm">to generate a payment QR code</p>
      </div>
    );
  }

  if (state === "loading") {
    return (
      <div className="bg-surface border border-border rounded-dome p-10 flex flex-col items-center justify-center text-center min-h-[480px]">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-muted text-sm">Generating QR code…</p>
      </div>
    );
  }

  if (state === "expired") {
    return (
      <div className="bg-surface border border-border rounded-dome p-10 flex flex-col items-center justify-center text-center min-h-[480px]">
        <div className="text-6xl mb-4">⏰</div>
        <p className="text-white font-bold text-lg mb-1">QR Code Expired</p>
        <p className="text-muted text-sm mb-6">Player did not complete payment</p>
        <button
          onClick={onNewBooking}
          className="bg-primary hover:bg-primary-hover text-white font-semibold px-6 py-3 rounded-dome transition-colors"
        >
          Generate New QR
        </button>
      </div>
    );
  }

  if (state === "paid" && booking) {
    return (
      <div className="bg-surface border border-border rounded-dome p-10 flex flex-col items-center justify-center text-center min-h-[480px]">
        <div className="text-6xl mb-4">✅</div>
        <p className="text-green-400 font-bold text-2xl mb-1">Payment Received</p>
        <p className="text-white text-3xl font-black mb-5">C${booking.totalCAD.toFixed(2)}</p>

        {booking.playerName !== "Walk-in Player" && (
          <p className="text-white font-semibold mb-1">{booking.playerName}</p>
        )}
        <p className="text-muted text-sm mb-1">
          {booking.date} · {fmtTime(booking.startTime)}–{fmtTime(booking.endTime)}
        </p>
        <p className="text-muted text-sm mb-6">
          {sportEmoji(booking.sport)} {sportLabel(booking.sport)} · {booking.courtName}
        </p>

        <div className="flex gap-3">
          <button
            onClick={onPrint}
            className="bg-surface-2 hover:bg-white/10 border border-border text-white text-sm font-semibold px-4 py-2.5 rounded-dome transition-colors flex items-center gap-2"
          >
            <span>📋</span> Print Receipt
          </button>
          <button
            onClick={onNewBooking}
            className="bg-primary hover:bg-primary-hover text-white text-sm font-semibold px-4 py-2.5 rounded-dome transition-colors flex items-center gap-2"
          >
            <span>🔳</span> New Walk-in
          </button>
        </div>
      </div>
    );
  }

  // state === "waiting"
  if (!booking) return null;

  return (
    <div className="bg-surface border border-border rounded-dome p-6 flex flex-col items-center min-h-[480px]">
      {/* Header row */}
      <div className="w-full flex items-center justify-between mb-5">
        <span className="text-xs font-bold text-muted tracking-widest uppercase">Scan to Pay</span>
        <div className="flex items-center gap-2">
          <span className="text-muted text-xs">💳</span>
          <button
            onClick={onFullscreen}
            className="text-xs text-muted hover:text-white transition-colors font-medium"
            title="Show fullscreen for customer"
          >
            ⛶ Fullscreen
          </button>
        </div>
      </div>

      {/* QR Code */}
      <div className="border-2 border-border rounded-xl p-3 mb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={booking.qrCodeDataUrl}
          alt="Payment QR code"
          className="w-[250px] h-[250px] rounded-lg"
        />
      </div>

      {/* Booking info */}
      <p className="text-white text-sm font-medium mb-0.5">
        {sportEmoji(booking.sport)} {sportLabel(booking.sport)} · {booking.courtName}
      </p>
      <p className="text-muted text-xs mb-4">
        {booking.date} · {fmtTime(booking.startTime)}–{fmtTime(booking.endTime)}
      </p>

      {/* Total */}
      <div className="w-full bg-black border border-border rounded-dome px-4 py-3 text-center mb-4">
        <p className="text-muted text-xs mb-0.5">Total Due</p>
        <p className="text-white text-3xl font-black">C${booking.totalCAD.toFixed(2)}</p>
      </div>

      <p className="text-muted text-xs mb-3">Apple Pay · Google Pay · Card</p>

      {/* Waiting + countdown */}
      <div className="flex items-center gap-2 text-muted text-sm mb-1">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        Waiting for payment…
      </div>
      {timeLeft && (
        <p className="text-muted text-xs mb-4">Expires in {timeLeft}</p>
      )}

      {/* Actions */}
      <div className="flex gap-3 mt-auto pt-4 w-full justify-center">
        <button
          onClick={onNewBooking}
          className="text-sm text-muted hover:text-white transition-colors font-medium"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            // open payment link in new tab (vendor can preview)
            window.open(booking.paymentLinkUrl, "_blank");
          }}
          className="text-sm text-primary hover:text-primary-hover transition-colors font-medium"
        >
          Open Link ↗
        </button>
      </div>
    </div>
  );
}

// ─── Today's Summary ──────────────────────────────────────────────────────────

function TodaysSummary({ history }: { history: WalkinHistory }) {
  if (history.count === 0) return null;

  const paid = history.bookings.filter(
    (b) => b.paymentStatus === "PAID" || b.status === "CONFIRMED"
  );

  return (
    <div className="bg-surface border border-border rounded-dome p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-muted tracking-widest uppercase">Today's Walk-ins</p>
        <p className="text-sm text-white font-semibold">
          {paid.length} booking{paid.length !== 1 ? "s" : ""} · C${history.totalRevenue.toFixed(2)} collected
        </p>
      </div>

      <div className="space-y-1">
        {history.bookings.map((b) => {
          const isPaid = b.paymentStatus === "PAID" || b.status === "CONFIRMED";
          // Extract sport from notes "Walk-in · PlayerName"
          const namePart = b.notes?.replace("Walk-in · ", "") ?? "Guest";
          const time = new Date(b.createdAt).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });

          return (
            <div key={b.id} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-white truncate">{namePart}</span>
                <span className="text-muted text-xs shrink-0">{time}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-medium text-white">C${b.totalCAD.toFixed(2)}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  isPaid
                    ? "bg-green-900/40 text-green-400"
                    : "bg-amber-900/40 text-amber-400"
                }`}>
                  {isPaid ? "Paid" : "Pending"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
