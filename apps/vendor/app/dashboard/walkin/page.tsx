"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import confetti from "canvas-confetti";
import Header from "../../../components/layout/Header";
import { api, apiFetch, type WalkinCreated, type WalkinHistory, type WalkinPrice } from "../../../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type PanelState = "idle" | "loading" | "waiting" | "paid" | "expired";

type FacilityCourt = {
  id: string;
  name: string;
  isActive: boolean;
  sports: string[];
  primarySport: string | null;
  facilityId: string;
};

type AvailableTime = {
  time: string;
  label: string;
  availableCourts: number;
  totalCourts: number;
  status: "AVAILABLE" | "PARTIAL" | "BOOKED";
};

type CourtRules = {
  minBookingMinutes: number;
  durationStepMinutes: number;
  maxBookingMinutes: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const SPORT_EMOJIS: Record<string, string> = {
  BADMINTON:  "🏸",
  PICKLEBALL: "🥒",
  TENNIS:     "🎾",
  BASKETBALL: "🏀",
  SOCCER:     "⚽",
  CRICKET:    "🏏",
  VOLLEYBALL: "🏐",
  HOCKEY:     "🏒",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSportEmoji(sport: string): string {
  return SPORT_EMOJIS[sport.toUpperCase()] ?? "🏅";
}

function getSportLabel(sport: string): string {
  return sport.charAt(0).toUpperCase() + sport.slice(1).toLowerCase();
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0]!;
}

function fmtTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ampm = h! >= 12 ? "PM" : "AM";
  const h12 = h! % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const labelCls = "text-xs font-bold text-muted uppercase tracking-wider block mb-2";

const disabledHintCls =
  "w-full px-4 py-3 rounded-dome border border-border/40 bg-black/30 text-muted text-sm italic";

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WalkinPage() {
  // Facility (auto-loaded)
  const [facilityId, setFacilityId] = useState("");
  const [facilityName, setFacilityName] = useState<string | null>(null);
  const [allCourts, setAllCourts] = useState<FacilityCourt[]>([]);
  const [sports, setSports] = useState<string[]>([]);

  // Step 1 — sport
  const [selectedSport, setSelectedSport] = useState("");

  // Step 2 — court (filtered by sport)
  const [selectedCourt, setSelectedCourt] = useState("");
  const [selectedCourtData, setSelectedCourtData] = useState<FacilityCourt | null>(null);
  const [durationOptions, setDurationOptions] = useState<number[]>([]);

  // Step 3 — date (enabled after court selected)
  const [selectedDate, setSelectedDate] = useState(todayStr());

  // Step 4 — time (fetched from API after court+date)
  const [availableTimes, setAvailableTimes] = useState<AvailableTime[]>([]);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [selectedTime, setSelectedTime] = useState("");

  // Step 5 — duration (enabled after time selected)
  const [selectedDuration, setSelectedDuration] = useState(0);

  // Player info
  const [playerName, setPlayerName] = useState("");
  const [playerPhone, setPlayerPhone] = useState("");

  // Pricing & history
  const [pricing, setPricing] = useState<WalkinPrice | null>(null);
  const [history, setHistory] = useState<WalkinHistory | null>(null);
  const [formError, setFormError] = useState("");
  const [generating, setGenerating] = useState(false);

  // QR panel
  const [panelState, setPanelState] = useState<PanelState>("idle");
  const [activeBooking, setActiveBooking] = useState<WalkinCreated | null>(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [paidAt, setPaidAt] = useState<Date | null>(null);

  const pricingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  // ─── Derived ─────────────────────────────────────────────────────────────────

  const filteredCourts = useMemo(
    () => allCourts.filter((c) => !selectedSport || c.sports?.includes(selectedSport)),
    [allCourts, selectedSport]
  );

  const isReady = !!(selectedSport && selectedCourt && selectedDate && selectedTime && selectedDuration);

  // ─── Load vendor's facilities on mount ───────────────────────────────────────

  useEffect(() => {
    api.vendor.facilities()
      .then((r) => {
        const active = r.data.filter((f) => f.isActive);
        if (!active.length) return;
        setFacilityName(active[0]!.name);
        const courts = active.flatMap((f) =>
          f.courts.filter((c) => c.isActive).map((c) => ({
            ...c,
            facilityId: f.id,
            // If no sports tagged on the court, inherit the facility's primary sport
            sports: c.sports?.length ? c.sports : [f.sport],
          }))
        );
        setAllCourts(courts);
        const sportSet = new Set<string>();
        active.forEach((f) => {
          sportSet.add(f.sport);
          f.courts.forEach((c) => c.sports?.forEach((s) => sportSet.add(s)));
        });
        setSports(Array.from(sportSet).filter(Boolean));
      })
      .catch(() => setFormError("Failed to load facility"));
  }, []);

  // ─── Load today's walk-in history ────────────────────────────────────────────

  const loadHistory = useCallback(() => {
    api.walkin.history()
      .then((r) => setHistory(r.data))
      .catch(() => null);
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // ─── Available times fetch ───────────────────────────────────────────────────

  async function fetchAvailableTimes(fId: string, date: string, duration: number) {
    if (!fId || !date) return;
    setLoadingTimes(true);
    setAvailableTimes([]);
    setSelectedTime("");
    try {
      const r = await apiFetch<{ data: { availableTimes: AvailableTime[] } }>(
        `/facilities/${fId}/available-times?date=${date}&duration=${duration}`
      );
      setAvailableTimes(r.data?.availableTimes ?? []);
    } catch {
      setAvailableTimes([]);
    } finally {
      setLoadingTimes(false);
    }
  }

  // ─── Cascade handlers ────────────────────────────────────────────────────────

  function handleSportSelect(sport: string) {
    setSelectedSport(sport);
    setSelectedCourt("");
    setSelectedCourtData(null);
    setAvailableTimes([]);
    setSelectedTime("");
    setSelectedDuration(0);
    setDurationOptions([]);
    setPricing(null);
    setFormError("");
  }

  async function handleCourtSelect(courtId: string) {
    const court = allCourts.find((c) => c.id === courtId) ?? null;
    setSelectedCourt(courtId);
    setSelectedCourtData(court);
    setSelectedTime("");
    setAvailableTimes([]);
    setPricing(null);
    setFormError("");

    if (!court) {
      setDurationOptions([]);
      setSelectedDuration(0);
      return;
    }

    const courtFacilityId = court.facilityId;
    setFacilityId(courtFacilityId);

    // Fetch court booking rules → build duration options
    let minDuration = 60;
    try {
      const rules = await apiFetch<{ data: CourtRules }>(`/vendor/courts/${courtId}`);
      const { minBookingMinutes: min, durationStepMinutes: step, maxBookingMinutes: max } = rules.data;
      minDuration = min;
      const opts: number[] = [];
      let cur = min;
      while (cur <= max) { opts.push(cur); cur += step; }
      setDurationOptions(opts);
      setSelectedDuration(min);
    } catch {
      setDurationOptions([60, 90, 120]);
      setSelectedDuration(60);
    }

    // Immediately fetch available times for the current date
    fetchAvailableTimes(courtFacilityId, selectedDate, minDuration);
  }

  function handleDateChange(date: string) {
    setSelectedDate(date);
    setSelectedTime("");
    setPricing(null);
    if (facilityId && selectedDuration) {
      fetchAvailableTimes(facilityId, date, selectedDuration);
    }
  }

  // ─── Pricing preview (debounced, fires when all 5 steps complete) ────────────

  useEffect(() => {
    if (!selectedCourt || !selectedDate || !selectedTime || !selectedDuration || !selectedSport) {
      setPricing(null);
      return;
    }
    if (pricingTimerRef.current) clearTimeout(pricingTimerRef.current);
    pricingTimerRef.current = setTimeout(() => {
      api.walkin.price({
        courtId: selectedCourt,
        date: selectedDate,
        startTime: selectedTime,
        durationMinutes: selectedDuration,
        sport: selectedSport,
      })
        .then((r) => setPricing(r.data))
        .catch(() => setPricing(null));
    }, 400);
    return () => { if (pricingTimerRef.current) clearTimeout(pricingTimerRef.current); };
  }, [selectedCourt, selectedDate, selectedTime, selectedDuration, selectedSport]);

  // ─── Countdown timer ─────────────────────────────────────────────────────────

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

  // ─── Poll for payment ────────────────────────────────────────────────────────

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function startPolling(bookingId: string) {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.walkin.status(bookingId);
        const status = res.data.status;
        if (status === "PAID") {
          stopPolling();
          setPaidAt(new Date());
          setPanelState("paid");
          setIsFullscreen(false);
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
          loadHistory();
        } else if (status === "EXPIRED") {
          stopPolling();
          setPanelState("expired");
        }
      } catch { /* ignore poll errors */ }
    }, 2000);
  }

  // Stop polling on unmount
  useEffect(() => () => stopPolling(), []);

  // ─── Generate QR ─────────────────────────────────────────────────────────────

  async function handleGenerate() {
    if (!isReady || !facilityId) {
      setFormError("Please fill in all required fields");
      return;
    }
    setFormError("");
    setGenerating(true);
    try {
      const res = await api.walkin.create({
        courtId: selectedCourt,
        facilityId,
        date: selectedDate,
        startTime: selectedTime,
        durationMinutes: selectedDuration,
        sport: selectedSport,
        playerName: playerName || undefined,
        playerPhone: playerPhone || undefined,
      });
      setActiveBooking(res.data);
      setPanelState("waiting");
      setPaidAt(null);
      startPolling(res.data.bookingId);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to generate QR code");
    } finally {
      setGenerating(false);
    }
  }

  function handleNewBooking() {
    stopPolling();
    setActiveBooking(null);
    setPanelState("idle");
    setPaidAt(null);
    // Reset full form
    setSelectedSport("");
    setSelectedCourt("");
    setSelectedCourtData(null);
    setAvailableTimes([]);
    setSelectedTime("");
    setSelectedDate(todayStr());
    setSelectedDuration(0);
    setDurationOptions([]);
    setPlayerName("");
    setPlayerPhone("");
    setPricing(null);
    setFormError("");
  }

  function handlePrintReceipt() {
    if (!activeBooking) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>Dome Walk-in Receipt</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; max-width: 300px; margin: 0 auto; }
        .logo { font-size: 24px; font-weight: 900; text-align: center; margin-bottom: 4px; }
        .sub { text-align: center; color: #666; font-size: 12px; margin-bottom: 12px; }
        .divider { border-top: 1px dashed #ccc; margin: 10px 0; }
        .row { display: flex; justify-content: space-between; margin: 5px 0; font-size: 13px; }
        .total { font-size: 22px; font-weight: 900; text-align: center; margin: 14px 0; }
        .footer { text-align: center; color: #999; font-size: 11px; margin-top: 14px; line-height: 1.6; }
      </style></head><body>
      <div class="logo">DOME</div>
      <div class="sub">Walk-in Receipt · ${activeBooking.facilityName}</div>
      <div class="divider"></div>
      <div class="row"><span>Sport</span><span>${getSportLabel(activeBooking.sport)}</span></div>
      <div class="row"><span>Court</span><span>${activeBooking.courtName}</span></div>
      <div class="row"><span>Date</span><span>${activeBooking.date}</span></div>
      <div class="row"><span>Time</span><span>${fmtTime(activeBooking.startTime)} – ${fmtTime(activeBooking.endTime)}</span></div>
      ${activeBooking.playerName !== "Walk-in Player" ? `<div class="row"><span>Player</span><span>${activeBooking.playerName}</span></div>` : ""}
      <div class="divider"></div>
      <div class="total">C$${activeBooking.totalCAD.toFixed(2)}</div>
      <div class="divider"></div>
      <div class="footer">
        Paid · ${paidAt?.toLocaleString("en-CA") ?? ""}<br/>
        Thank you for playing!<br/>
        dome.app
      </div>
      </body></html>
    `);
    w.document.close();
    w.print();
  }

  // ─── Fullscreen QR view ──────────────────────────────────────────────────────

  if (isFullscreen && activeBooking && panelState === "waiting") {
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-50 p-8">
        <button
          onClick={() => setIsFullscreen(false)}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-sm font-medium"
        >
          ✕ Exit Fullscreen
        </button>
        <p className="text-gray-500 text-sm font-semibold tracking-widest uppercase mb-6">Scan to Pay</p>
        <div className="border-4 border-gray-100 rounded-2xl p-4 mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={activeBooking.qrCodeDataUrl} alt="Payment QR code" className="w-72 h-72" />
        </div>
        <div className="bg-gray-50 rounded-2xl px-10 py-5 mb-4 text-center">
          <p className="text-gray-500 text-sm mb-1">Total Due</p>
          <p className="text-5xl font-black text-gray-900">C${activeBooking.totalCAD.toFixed(2)}</p>
        </div>
        <p className="text-gray-400 text-sm text-center">
          {getSportEmoji(activeBooking.sport)} {getSportLabel(activeBooking.sport)} · {activeBooking.courtName}
          <br />
          {activeBooking.date} · {fmtTime(activeBooking.startTime)}–{fmtTime(activeBooking.endTime)}
        </p>
        <p className="mt-4 text-gray-400 text-xs">Apple Pay · Google Pay · Card · Expires in {timeLeft}</p>
      </div>
    );
  }

  // ─── Print styles ─────────────────────────────────────────────────────────────

  const printStyles = activeBooking ? `
    @media print {
      body * { visibility: hidden !important; }
      #print-receipt, #print-receipt * { visibility: visible !important; }
      #print-receipt { position: fixed; top: 0; left: 0; width: 100%; }
    }
  ` : "";

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {printStyles && <style dangerouslySetInnerHTML={{ __html: printStyles }} />}

      {activeBooking && (
        <div id="print-receipt" className="hidden print:block p-8 max-w-sm mx-auto">
          <div className="text-center mb-6">
            <p className="text-2xl font-black">Dome</p>
            <p className="text-sm text-gray-500">{activeBooking.facilityName}</p>
          </div>
          <div className="border-t border-b border-gray-200 py-4 mb-4 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Sport</span><span>{getSportLabel(activeBooking.sport)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Court</span><span>{activeBooking.courtName}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Date</span><span>{activeBooking.date}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Time</span><span>{fmtTime(activeBooking.startTime)}–{fmtTime(activeBooking.endTime)}</span></div>
            <div className="flex justify-between font-bold text-base pt-2"><span>Total Paid</span><span>C${activeBooking.totalCAD.toFixed(2)}</span></div>
          </div>
          <p className="text-center text-gray-500 text-xs">Thank you for playing!</p>
        </div>
      )}

      <Header title="Walk-in POS" />

      <main className="flex-1 p-6 overflow-auto space-y-6">
        <div className="flex gap-6 items-start">

          {/* ── LEFT: Booking Form ── */}
          <div className="w-[440px] shrink-0 bg-surface border border-border rounded-dome p-6 space-y-6">
            <p className="text-xs font-bold text-muted tracking-widest uppercase">New Walk-in Booking</p>

            {formError && (
              <div className="bg-red-900/30 border border-red-700 rounded-dome px-3 py-2 text-sm text-red-300">
                {formError}
              </div>
            )}

            {/* Facility label */}
            <div className="bg-black border border-border rounded-dome px-4 py-3">
              <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-0.5">Facility</p>
              <p className="text-[15px] font-bold text-white">{facilityName ?? "Loading…"}</p>
            </div>

            {/* ── Step 1: Sport ── */}
            <div className="space-y-2">
              <label className={labelCls}>Sport *</label>
              {sports.length === 0 ? (
                <p className="text-muted text-xs">Loading sports…</p>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {sports.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleSportSelect(s)}
                      className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                        selectedSport === s
                          ? "bg-primary text-white"
                          : "border border-border bg-black text-[#CCCCCC] hover:text-white hover:border-white/30"
                      }`}
                    >
                      {getSportEmoji(s)} {getSportLabel(s)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Step 2: Court ── */}
            <div className="space-y-1.5">
              <label className={labelCls}>Court *</label>
              <select
                value={selectedCourt}
                onChange={(e) => handleCourtSelect(e.target.value)}
                disabled={!selectedSport}
                className="w-full bg-black border border-border rounded-dome px-3 py-2 text-sm text-white focus:outline-none focus:border-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value="">{!selectedSport ? "Select a sport first" : "Select court"}</option>
                {filteredCourts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* ── Step 3: Date ── */}
            <div className="space-y-1.5">
              <label className={labelCls}>Date *</label>
              <div className="relative">
                <input
                  ref={dateRef}
                  type="date"
                  value={selectedDate}
                  min={todayStr()}
                  onChange={(e) => handleDateChange(e.target.value)}
                  disabled={!selectedCourt}
                  className="w-full bg-black border border-border rounded-dome pl-3 pr-10 py-2 text-sm text-white focus:outline-none focus:border-primary disabled:opacity-40 disabled:cursor-not-allowed [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:hidden"
                />
                <button
                  type="button"
                  onClick={() => dateRef.current?.showPicker?.()}
                  disabled={!selectedCourt}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-white transition-colors disabled:opacity-40"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 2v4M16 2v4" /><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18" />
                  </svg>
                </button>
              </div>
              {!selectedCourt && (
                <p className="text-[11px] text-muted/60 mt-1">Select a court first</p>
              )}
            </div>

            {/* ── Step 4: Time ── */}
            <div className="space-y-2">
              <label className={labelCls}>Start Time *</label>

              {!selectedCourt ? (
                <p className={disabledHintCls}>Select a court first</p>
              ) : loadingTimes ? (
                <div className="flex items-center gap-2 text-muted text-sm py-2">
                  <span className="w-3 h-3 border-2 border-muted border-t-transparent rounded-full animate-spin" />
                  Loading available times…
                </div>
              ) : availableTimes.length === 0 ? (
                <div className="px-4 py-3 rounded-dome border border-red-900/50 bg-red-950/20 text-red-400 text-sm">
                  No available slots on this date — generate slots first
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto p-0.5">
                    {availableTimes
                      .filter((t) => t.status !== "BOOKED")
                      .map((t) => (
                        <button
                          key={t.time}
                          type="button"
                          onClick={() => setSelectedTime(t.time)}
                          className={`px-3 py-1.5 rounded-dome text-xs font-semibold transition-colors relative ${
                            selectedTime === t.time
                              ? "bg-primary text-white"
                              : t.status === "PARTIAL"
                              ? "border border-amber-700/60 bg-amber-950/30 text-amber-300 hover:border-amber-500"
                              : "border border-border bg-black text-[#CCCCCC] hover:text-white hover:border-white/30"
                          }`}
                        >
                          {t.label}
                          {t.status === "PARTIAL" && (
                            <span className="ml-1 text-[9px] text-amber-400">◐</span>
                          )}
                        </button>
                      ))}
                  </div>
                  <p className="text-[11px] text-muted/60">
                    ● Available · ◐ Limited ·{" "}
                    {availableTimes.filter((t) => t.status !== "BOOKED").length} slots open
                  </p>
                </>
              )}
            </div>

            {/* ── Step 5: Duration ── */}
            <div className="space-y-2">
              <label className={labelCls}>Duration *</label>

              {!selectedCourtData ? (
                <p className={disabledHintCls}>Select a court to see duration options</p>
              ) : (
                <>
                  <div className="flex gap-2 flex-wrap">
                    {durationOptions.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setSelectedDuration(d)}
                        disabled={!selectedTime}
                        className={`px-4 py-2 text-xs font-semibold rounded-dome transition-colors ${
                          selectedDuration === d
                            ? "bg-primary text-white"
                            : "bg-black border border-border text-muted hover:text-white hover:border-white/30 disabled:opacity-40 disabled:cursor-not-allowed"
                        }`}
                      >
                        {formatDuration(d)}
                      </button>
                    ))}
                  </div>
                  {!selectedTime && (
                    <p className="text-[11px] text-muted/60">Select a time first</p>
                  )}
                </>
              )}
            </div>

            {/* ── Player Info (optional) ── */}
            <div className="space-y-3">
              <p className={labelCls}>Player Info (optional)</p>
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

            {/* ── Booking summary + pricing ── */}
            {isReady && (
              <div className="border border-border rounded-dome px-4 py-4 bg-black/40 space-y-1.5">
                <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-2">Booking Summary</p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">
                    {getSportEmoji(selectedSport)} {selectedCourtData?.name}
                  </span>
                  <span className="text-white font-bold">
                    {pricing ? `C$${pricing.totalCAD.toFixed(2)}` : "…"}
                  </span>
                </div>
                <p className="text-xs text-muted/70">
                  {selectedDate} · {fmtTime(selectedTime)} · {formatDuration(selectedDuration)}
                </p>
                {pricing && (
                  <div className="border-t border-border/50 pt-2 mt-2 space-y-1 text-xs text-muted">
                    <div className="flex justify-between">
                      <span>Subtotal</span><span>C${pricing.subtotalCAD.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax ({Math.round(pricing.taxRate * 100)}%)</span>
                      <span>C${pricing.taxCAD.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-white text-sm border-t border-border/50 pt-1 mt-1">
                      <span>Total</span><span>C${pricing.totalCAD.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Generate QR button ── */}
            <button
              onClick={handleGenerate}
              disabled={generating || !isReady}
              className={`w-full font-bold py-3.5 rounded-dome transition-all flex items-center justify-center gap-2 text-sm ${
                isReady
                  ? "bg-primary hover:bg-primary-hover text-white"
                  : "bg-surface border border-border text-muted cursor-not-allowed"
              }`}
            >
              {generating ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isReady ? (
                <><span>🔳</span> Generate QR Code</>
              ) : (
                "Complete all fields above"
              )}
            </button>
          </div>

          {/* ── RIGHT: QR Panel ── */}
          <div className="flex-1 min-w-0">
            <QRPanel
              state={panelState}
              booking={activeBooking}
              timeLeft={timeLeft}
              paidAt={paidAt}
              todayCount={history?.count ?? 0}
              todayRevenue={history?.totalRevenue ?? 0}
              onFullscreen={() => setIsFullscreen(true)}
              onNewBooking={handleNewBooking}
              onPrint={handlePrintReceipt}
            />
          </div>
        </div>

        {history && <TodaysSummary history={history} />}
      </main>
    </>
  );
}

// ─── QR Panel ─────────────────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function QRPanel({
  state, booking, timeLeft, paidAt, todayCount, todayRevenue,
  onFullscreen, onNewBooking, onPrint,
}: {
  state: PanelState;
  booking: WalkinCreated | null;
  timeLeft: string;
  paidAt: Date | null;
  todayCount: number;
  todayRevenue: number;
  onFullscreen: () => void;
  onNewBooking: () => void;
  onPrint: () => void;
}) {
  if (state === "idle") {
    return (
      <div className="bg-surface border border-border rounded-dome p-10 flex flex-col items-center justify-center text-center min-h-[520px]">
        <div className="text-6xl mb-4 opacity-30">🔳</div>
        <p className="text-white font-semibold mb-1">Fill in booking details</p>
        <p className="text-muted text-sm">to generate a payment QR code</p>
      </div>
    );
  }

  if (state === "loading") {
    return (
      <div className="bg-surface border border-border rounded-dome p-10 flex flex-col items-center justify-center text-center min-h-[520px]">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-muted text-sm">Generating QR code…</p>
      </div>
    );
  }

  if (state === "expired") {
    return (
      <div className="bg-surface border border-border rounded-dome p-10 flex flex-col items-center justify-center text-center min-h-[520px]">
        <div className="text-6xl mb-4">⏰</div>
        <p className="text-white font-bold text-lg mb-1">QR Code Expired</p>
        <p className="text-muted text-sm mb-6">Player did not complete payment in time</p>
        <button onClick={onNewBooking} className="bg-primary hover:bg-primary-hover text-white font-semibold px-6 py-3 rounded-dome transition-colors">
          Generate New QR
        </button>
      </div>
    );
  }

  if (state === "paid" && booking) {
    return (
      <div className="bg-surface border border-border rounded-dome p-8 flex flex-col items-center min-h-[520px]">
        {/* Success icon */}
        <div className="w-20 h-20 rounded-full bg-green-500/10 border-2 border-green-500/40 flex items-center justify-center text-4xl mb-5 mt-2">
          ✅
        </div>

        <p className="text-green-400 font-black text-2xl tracking-tight mb-1">PAYMENT RECEIVED</p>
        <p className="text-white text-4xl font-black mb-1">C${booking.totalCAD.toFixed(2)}</p>
        {paidAt && (
          <p className="text-muted text-xs mb-6">
            Paid at {paidAt.toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}

        {/* Booking details grid */}
        <div className="w-full bg-black/40 border border-border rounded-dome px-5 py-4 mb-5 grid grid-cols-2 gap-x-6 gap-y-4">
          <DetailRow label="Sport" value={`${getSportEmoji(booking.sport)} ${getSportLabel(booking.sport)}`} />
          <DetailRow label="Court" value={booking.courtName} />
          <DetailRow label="Date" value={new Date(booking.date).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })} />
          <DetailRow label="Time" value={`${fmtTime(booking.startTime)} – ${fmtTime(booking.endTime)}`} />
          {booking.playerName !== "Walk-in Player" && (
            <DetailRow label="Player" value={booking.playerName} />
          )}
          <DetailRow label="Facility" value={booking.facilityName} />
        </div>

        {/* Actions */}
        <div className="flex gap-3 w-full mb-4">
          <button onClick={onPrint}
            className="flex-1 bg-surface-2 hover:bg-white/10 border border-border text-white text-sm font-semibold py-3 rounded-dome transition-colors flex items-center justify-center gap-2">
            🖨️ Print Receipt
          </button>
          <button onClick={onNewBooking}
            className="flex-1 bg-primary hover:bg-primary-hover text-white text-sm font-bold py-3 rounded-dome transition-colors flex items-center justify-center gap-2">
            + New Walk-in
          </button>
        </div>

        {/* Today's stats */}
        {todayCount > 0 && (
          <p className="text-muted text-xs text-center">
            🎉 Walk-in #{todayCount} today · C${todayRevenue.toFixed(2)} collected
          </p>
        )}
      </div>
    );
  }

  if (!booking) return null;

  return (
    <div className="bg-surface border border-border rounded-dome p-6 flex flex-col items-center min-h-[520px]">
      <div className="w-full flex items-center justify-between mb-5">
        <span className="text-xs font-bold text-muted tracking-widest uppercase">Scan to Pay</span>
        <div className="flex items-center gap-2">
          <span className="text-muted text-xs">💳</span>
          <button onClick={onFullscreen} className="text-xs text-muted hover:text-white transition-colors font-medium">
            ⛶ Fullscreen
          </button>
        </div>
      </div>
      <div className="border-2 border-border rounded-xl p-3 mb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={booking.qrCodeDataUrl} alt="Payment QR code" className="w-[250px] h-[250px] rounded-lg" />
      </div>
      <p className="text-white text-sm font-medium mb-0.5">
        {getSportEmoji(booking.sport)} {getSportLabel(booking.sport)} · {booking.courtName}
      </p>
      <p className="text-muted text-xs mb-4">{booking.date} · {fmtTime(booking.startTime)}–{fmtTime(booking.endTime)}</p>
      <div className="w-full bg-black border border-border rounded-dome px-4 py-3 text-center mb-4">
        <p className="text-muted text-xs mb-0.5">Total Due</p>
        <p className="text-white text-3xl font-black">C${booking.totalCAD.toFixed(2)}</p>
      </div>
      <p className="text-muted text-xs mb-3">Apple Pay · Google Pay · Card</p>
      <div className="flex items-center gap-2 text-muted text-sm mb-1">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        Waiting for payment…
      </div>
      {timeLeft && <p className="text-muted text-xs mb-4">Expires in {timeLeft}</p>}
      <div className="flex gap-3 mt-auto pt-4 w-full justify-center">
        <button onClick={onNewBooking} className="text-sm text-muted hover:text-white transition-colors font-medium">Cancel</button>
        <button onClick={() => window.open(booking.paymentLinkUrl, "_blank")} className="text-sm text-primary hover:text-primary-hover transition-colors font-medium">
          Open Link ↗
        </button>
      </div>
    </div>
  );
}

// ─── Today's Summary ──────────────────────────────────────────────────────────

function TodaysSummary({ history }: { history: WalkinHistory }) {
  if (history.count === 0) return null;
  const paid = history.bookings.filter((b) => b.paymentStatus === "PAID" || b.status === "CONFIRMED");
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
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${isPaid ? "bg-green-900/40 text-green-400" : "bg-amber-900/40 text-amber-400"}`}>
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
