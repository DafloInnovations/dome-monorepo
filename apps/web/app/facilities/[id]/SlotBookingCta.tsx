"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL, apiFetch } from "../../../lib/api";
import { clearToken, getStoredUser, getToken, setToken, setStoredUser } from "../../../lib/auth";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FALLBACK_DURATIONS = [30, 60, 90, 120, 180];

function buildDurationOptions(minDuration: number, step: number, maxDuration: number): number[] {
  const opts: number[] = [];
  for (let d = minDuration; d <= maxDuration; d += step) opts.push(d);
  return opts.length > 0 ? opts : FALLBACK_DURATIONS;
}

interface PriceBreakdown {
  basePriceCAD: number;
  appliedRule: string | null;
  finalPriceCAD: number;
}

interface BookingRules {
  minDuration: number;
  step: number;
  maxDuration: number;
}

interface AvailableCourt {
  id: string;
  name: string;
  unitLabel: string;
  sport: string;
  surface: string;
  // Shared court fields
  isShared: boolean;
  sports: string[];
  primarySport: string | null;
  requestedSport: string | null;
  unavailableReason: string | null;
  totalPriceCAD: number;
  basePriceCAD: number;
  priceBreakdown: PriceBreakdown | null;
  isAvailable: boolean;
  notCovered: boolean;
  slots: string[];
  bookedUntil: string | null;
  minBookingMinutes: number;
  durationStepMinutes: number;
  maxBookingMinutes: number;
}

interface AvailableCourtsResult {
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  courts: AvailableCourt[];
}

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

interface AvailableTime {
  time: string;    // HH:mm
  label: string;   // "10:00 AM"
  status: "AVAILABLE" | "PARTIAL" | "BOOKED";
  availableCourts: number;
}

interface EquipmentItem {
  id: string;
  name: string;
  description: string | null;
  sport: string;
  priceCAD: number;
  quantity: number;
  availableQuantity: number;
}

const SPORT_EMOJI: Record<string, string> = {
  BADMINTON: "🏸", TENNIS: "🎾", BASKETBALL: "🏀", SOCCER: "⚽",
  PICKLEBALL: "🏓", VOLLEYBALL: "🏐", HOCKEY: "🏒", CRICKET: "🏏",
  BASEBALL: "⚾", SQUASH: "🎾",
};

// ─── Inline auth + onboarding modal ─────────────────────────────────────────

type AuthStep = "phone" | "otp" | "profile";

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={`block rounded-full transition-all ${
          i < current ? "w-4 h-1.5 bg-primary" : i === current ? "w-4 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-border"
        }`} />
      ))}
      <span className="text-xs text-muted ml-1">{current + 1} of {total}</span>
    </div>
  );
}

function AuthModal({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const [step, setStep]       = useState<AuthStep>("phone");
  const [phone, setPhone]     = useState("");
  const [otp, setOtp]         = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail]     = useState("");
  const [isNewUser, setIsNewUser] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const otpRef     = useRef<HTMLInputElement>(null);
  const nameRef    = useRef<HTMLInputElement>(null);

  const totalSteps = isNewUser ? 2 : 1;
  const currentStep = step === "profile" ? 1 : 0;

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/send-otp`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(b.message ?? "Failed to send code");
      }
      setStep("otp");
      setTimeout(() => otpRef.current?.focus(), 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally { setLoading(false); }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/verify-otp`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: otp }),
      });
      const data = await res.json() as {
        data?: {
          accessToken?: string;
          isNewUser?: boolean;
          user?: { id?: string; phone?: string; firstName?: string; lastName?: string; role?: string; creditBalanceCAD?: number };
        };
        message?: string;
      };
      if (!res.ok) throw new Error(data.message ?? "Invalid code");
      setToken(data.data!.accessToken!);
      const u = data.data!.user!;
      setStoredUser({ id: u.id ?? "", phone: u.phone ?? "", firstName: u.firstName ?? "", lastName: u.lastName ?? "", role: u.role ?? "PLAYER", creditBalanceCAD: u.creditBalanceCAD });
      const newUser = data.data!.isNewUser ?? false;
      setIsNewUser(newUser);
      if (newUser) {
        setStep("profile");
        setTimeout(() => nameRef.current?.focus(), 50);
      } else {
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally { setLoading(false); }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = fullName.trim();
    if (!trimmed) { setError("Please enter your full name."); return; }
    const parts     = trimmed.split(/\s+/);
    const firstName = parts[0]!;
    const lastName  = parts.slice(1).join(" ") || firstName;
    setError(""); setLoading(true);
    const token = getToken();
    try {
      const nameRes = await fetch(`${API_URL}/users/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ firstName, lastName }),
      });
      if (!nameRes.ok) {
        const b = await nameRes.json().catch(() => ({})) as { message?: string };
        throw new Error(b.message ?? "Failed to save name");
      }
      if (email.trim()) {
        const emailRes = await fetch(`${API_URL}/users/me/email`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        });
        if (!emailRes.ok) {
          const b = await emailRes.json().catch(() => ({})) as { message?: string };
          throw new Error(b.message ?? "Failed to save email");
        }
      }
      const stored = getStoredUser();
      if (stored) setStoredUser({ ...stored, firstName, lastName });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally { setLoading(false); }
  }

  const inputCls = "w-full bg-[#0a0a0a] border border-white/10 rounded-dome px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-primary transition-colors text-sm";

  const headings: Record<AuthStep, string> = {
    phone:   "Sign in to book",
    otp:     "Enter your code",
    profile: "Complete your profile",
  };
  const subheadings: Record<AuthStep, string> = {
    phone:   "Enter your phone number to continue",
    otp:     `Sent to ${phone}`,
    profile: "Just a few details and you're all set",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 px-4 pb-4 sm:pb-0">
      <div className="w-full max-w-sm bg-[#121212] border border-white/10 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/[0.06]">
          <div className="flex items-start justify-between mb-3">
            {isNewUser && step !== "phone" ? (
              <StepDots current={currentStep} total={totalSteps} />
            ) : (
              <span className="text-xs text-white/40 font-semibold uppercase tracking-widest">DOME</span>
            )}
            <button onClick={onClose} className="text-white/40 hover:text-white transition-colors text-xl leading-none -mt-0.5">×</button>
          </div>
          <h3 className="text-xl font-bold text-white mt-1">{headings[step]}</h3>
          <p className="text-sm text-white/50 mt-0.5">{subheadings[step]}</p>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {step === "phone" && (
            <form onSubmit={sendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">Phone Number</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 416 555 0123" required autoFocus className={inputCls} />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button type="submit" disabled={loading || !phone}
                className="w-full bg-primary hover:bg-primary/90 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors text-sm">
                {loading ? "Sending…" : "Send Code"}
              </button>
              <p className="text-xs text-white/30 text-center">Your court selection is saved — you won&apos;t lose it.</p>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={verifyOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">6-Digit Code</label>
                <input ref={otpRef} type="text" value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000" maxLength={6} required
                  className={`${inputCls} text-center text-2xl tracking-widest font-mono`} />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button type="submit" disabled={loading || otp.length < 6}
                className="w-full bg-primary hover:bg-primary/90 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors text-sm">
                {loading ? "Verifying…" : "Verify & Continue"}
              </button>
              <button type="button" onClick={() => { setStep("phone"); setOtp(""); setError(""); }}
                className="w-full text-sm text-white/40 hover:text-white transition-colors">
                ← Change number
              </button>
            </form>
          )}

          {step === "profile" && (
            <form onSubmit={saveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">Full Name</label>
                <input ref={nameRef} type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Smith" required className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">
                  Email Address <span className="text-white/20 normal-case font-normal">(optional)</span>
                </label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@example.com" className={inputCls} />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button type="submit" disabled={loading || !fullName.trim()}
                className="w-full bg-primary hover:bg-primary/90 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors text-sm">
                {loading ? "Saving…" : "Continue to Checkout →"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  facilityId: string;
  facilityName: string;
  sport?: string;
}

export default function SlotBookingCta({ facilityId, facilityName, sport }: Props) {
  const router = useRouter();
  const days = getNext7Days();

  const [dayIdx, setDayIdx] = useState(0);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(60);
  const [bookingRules, setBookingRules] = useState<BookingRules | null>(null);
  const [availableTimes, setAvailableTimes] = useState<AvailableTime[]>([]);
  const [timesLoading, setTimesLoading] = useState(false);
  const [courtsResult, setCourtsResult] = useState<AvailableCourtsResult | null>(null);
  const [courtsLoading, setCourtsLoading] = useState(false);
  const [selectedCourts, setSelectedCourts] = useState<AvailableCourt[]>([]);
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const pendingAction = useRef<(() => Promise<void>) | null>(null);

  // Coupon state
  const [couponInput, setCouponInput] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponApplied, setCouponApplied] = useState<{ code: string; description: string | null; discountCAD: number } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [alertSet, setAlertSet] = useState(false);
  const [alertLoading, setAlertLoading] = useState(false);

  // Credits state
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [useCredits, setUseCredits] = useState(false);
  const [creditsMode, setCreditsMode] = useState<"all" | "partial">("all");
  const [creditsPartialInput, setCreditsPartialInput] = useState("");

  // Equipment state
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [equipmentSelected, setEquipmentSelected] = useState<Record<string, number>>({});

  // Recurring state
  const [recurringOn, setRecurringOn] = useState(false);
  const [recurringFreq, setRecurringFreq] = useState<"WEEKLY" | "BIWEEKLY">("WEEKLY");
  const [recurringWeeks, setRecurringWeeks] = useState(8);
  const [recurringPayModel, setRecurringPayModel] = useState<"PAY_PER_SESSION" | "PAY_UPFRONT">("PAY_PER_SESSION");

  const date = formatDate(days[dayIdx]!);
  const endTime = startTime ? addMins(startTime, duration) : null;
  const isToday = dayIdx === 0;

  // Fetch available start times when date or duration changes
  useEffect(() => {
    setStartTime(null);
    setCourtsResult(null);
    setSelectedCourts([]);
    setAvailableTimes([]);
    setTimesLoading(true);
    const qs = new URLSearchParams({ date, duration: String(duration) });
    fetch(`${API_URL}/facilities/${facilityId}/available-times?${qs}`)
      .then((r) => r.json())
      .then((json: { data?: { availableTimes?: AvailableTime[] } }) => {
        const now = new Date();
        const nowMins = now.getHours() * 60 + now.getMinutes();
        const times = (json.data?.availableTimes ?? []).filter((t) => {
          if (t.status === "BOOKED") return false;
          if (isToday) {
            const [h, m] = t.time.split(":").map(Number);
            if (h! * 60 + m! <= nowMins) return false;
          }
          return true;
        });
        setAvailableTimes(times);
      })
      .catch(() => setAvailableTimes([]))
      .finally(() => setTimesLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityId, date, duration]);

  // Fetch available courts whenever date/time/duration/sport changes
  useEffect(() => {
    setAlertSet(false);
    if (!startTime) { setCourtsResult(null); setSelectedCourts([]); return; }
    setCourtsLoading(true);
    setSelectedCourts([]);
    const qs = new URLSearchParams({ date, startTime, duration: String(duration) });
    if (selectedSport) qs.set("sport", selectedSport);
    fetch(`${API_URL}/facilities/${facilityId}/available-courts?${qs}`)
      .then((r) => r.json())
      .then((json: { data: AvailableCourtsResult }) => setCourtsResult(json.data))
      .catch(() => setCourtsResult(null))
      .finally(() => setCourtsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityId, date, startTime, duration, selectedSport]);

  // Fetch booking rules from the facility's courts at mount
  useEffect(() => {
    fetch(`${API_URL}/facilities/${facilityId}`)
      .then((r) => r.json())
      .then((json: { data?: { courts?: { minBookingMinutes: number; durationStepMinutes: number; maxBookingMinutes: number }[] } }) => {
        const courts = json.data?.courts ?? [];
        if (!courts.length) return;
        // Use the most permissive rules across all courts (lowest min, highest max, smallest step)
        const minDuration = Math.min(...courts.map((c) => c.minBookingMinutes));
        const maxDuration = Math.max(...courts.map((c) => c.maxBookingMinutes));
        const step = Math.min(...courts.map((c) => c.durationStepMinutes));
        const rules = { minDuration, step, maxDuration };
        setBookingRules(rules);
        // Reset selected duration to min if current value isn't valid under new rules
        setDuration((prev) => {
          const opts = buildDurationOptions(rules.minDuration, rules.step, rules.maxDuration);
          return opts.includes(prev) ? prev : rules.minDuration;
        });
      })
      .catch(() => null);
  }, [facilityId]);

  // Fetch equipment once when facilityId/sport is known
  useEffect(() => {
    if (!facilityId) return;
    const qs = sport ? `?sport=${encodeURIComponent(sport)}` : "";
    fetch(`${API_URL}/facilities/${facilityId}/equipment${qs}`)
      .then((r) => r.json())
      .then((json: { data: EquipmentItem[] }) => setEquipment(json.data ?? []))
      .catch(() => null);
  }, [facilityId, sport]);

  // Fetch credit balance if user is logged in
  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = getToken();
    if (!token) return;
    fetch(`${API_URL}/users/me/credits`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (r.status === 401) { return null; }
        return r.json() as Promise<{ balance?: number }>;
      })
      .then((json) => {
        if (json && typeof json.balance === "number") setCreditBalance(json.balance);
      })
      .catch(() => null);
  }, []);

  // Run an action — if not logged in, persist booking state and show auth modal
  function requireAuth(action: () => Promise<void>) {
    if (getStoredUser() && getToken()) {
      void action();
    } else {
      // Persist selection so it survives if the page ever refreshes
      if (typeof window !== "undefined") {
        localStorage.setItem("dome_pending_booking", JSON.stringify({
          facilityId, date, startTime, duration,
          courtIds: selectedCourts.map((c) => c.id),
        }));
      }
      pendingAction.current = action;
      setShowAuthModal(true);
    }
  }

  function onAuthSuccess() {
    if (typeof window !== "undefined") localStorage.removeItem("dome_pending_booking");
    setShowAuthModal(false);
    const action = pendingAction.current;
    pendingAction.current = null;
    if (action) void action();
  }

  function courtKey(court: AvailableCourt) {
    return court.isShared ? `${court.id}:${court.sport}` : court.id;
  }

  function toggleCourt(court: AvailableCourt) {
    if (!court.isAvailable) return;
    const key = courtKey(court);
    setSelectedCourts((prev) =>
      prev.find((c) => courtKey(c) === key)
        ? prev.filter((c) => courtKey(c) !== key)
        : [...prev, court]
    );
  }

  // Derive available sports from the courts result (for shared courts sport filter)
  const allSports = courtsResult
    ? [...new Set(courtsResult.courts.flatMap((c) => c.isShared ? c.sports : [c.sport]))]
    : [];
  const hasSharedCourts = courtsResult?.courts.some((c) => c.isShared) ?? false;

  async function handleBook() {
    if (!selectedCourts.length || !startTime) return;
    const user = getStoredUser();
    if (!user) { requireAuth(handleBook); return; }

    setBookingLoading(true);
    setBookingError("");
    try {
      const slotIds = selectedCourts.flatMap((c) => c.slots);
      const result = await apiFetch<{
        data: { type: string; bookingId: string | null; groupId: string | null; fullyPaidWithCredits?: boolean; clientSecret: string | null; totalCAD: number; subtotalCAD: number; taxCAD: number; creditsAppliedCAD?: number; cardChargeCAD?: number };
      }>("/bookings/time-based", {
        method: "POST",
        body: JSON.stringify({
          slotIds,
          facilityId,
          useCredits: useCredits && creditsAvailable > 0,
          creditsToUse: creditsMode === "partial" && creditsPartialAmt > 0 ? creditsPartialAmt : undefined,
          couponCode: couponApplied?.code,
        }),
      });

      const { type, bookingId, groupId, fullyPaidWithCredits, clientSecret, totalCAD } = result.data;

      // Fully paid with credits — booking already confirmed
      if (fullyPaidWithCredits) {
        const courtNames = selectedCourts.map((c) => c.name).join(", ");
        const params = new URLSearchParams({
          facilityId,
          facilityName,
          date,
          startTime,
          endTime: endTime!,
          durationMinutes: String(duration),
          courts: courtNames,
          clientSecret: "credits",
          totalCAD: String(totalCAD),
          subtotalCAD: String(result.data.subtotalCAD ?? totalCAD),
          taxCAD: String(result.data.taxCAD ?? 0),
          creditsApplied: String(result.data.creditsAppliedCAD ?? 0),
          ...(type === "single" && bookingId ? { bookingId } : {}),
          ...(type === "group" && groupId ? { groupId } : {}),
        });
        router.push(`/book/time-based?${params}`);
        return;
      }

      // Add equipment if selected (updates PaymentIntent amount server-side)
      const equipItems = Object.entries(equipmentSelected)
        .filter(([, qty]) => qty > 0)
        .map(([equipmentId, quantity]) => ({ equipmentId, quantity }));
      if (equipItems.length > 0 && type === "single" && bookingId) {
        await apiFetch(`/bookings/${bookingId}/equipment`, {
          method: "POST",
          body: JSON.stringify({ items: equipItems }),
        });
      }

      const courtNames = selectedCourts.map((c) => c.name).join(", ");
      const params = new URLSearchParams({
        facilityId,
        facilityName,
        date,
        startTime,
        endTime: endTime!,
        durationMinutes: String(duration),
        courts: courtNames,
        clientSecret: clientSecret!,
        totalCAD: String(result.data.totalCAD),
        subtotalCAD: String(result.data.subtotalCAD ?? result.data.totalCAD),
        taxCAD: String(result.data.taxCAD ?? 0),
        ...(type === "single" && bookingId ? { bookingId } : {}),
        ...(type === "group" && groupId ? { groupId } : {}),
      });
      router.push(`/book/time-based?${params}`);
    } catch (e) {
      if ((e as { status?: number }).status === 401) {
        clearToken();
        pendingAction.current = handleBook;
        setShowAuthModal(true);
        return;
      }
      setBookingError(e instanceof Error ? e.message : "Booking failed. Please try again.");
    } finally {
      setBookingLoading(false);
    }
  }

  async function handleSetAlert() {
    if (!startTime || !endTime) return;
    const user = getStoredUser();
    if (!user) { requireAuth(handleSetAlert); return; }
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
      if ((e as { status?: number }).status === 401) {
        clearToken();
        pendingAction.current = handleSetAlert;
        setShowAuthModal(true);
        return;
      }
      setBookingError(e instanceof Error ? e.message : "Failed to set alert");
    } finally {
      setAlertLoading(false);
    }
  }

  async function handleValidateCoupon() {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    const user = getStoredUser();
    if (!user) { requireAuth(handleValidateCoupon); return; }
    setCouponLoading(true);
    setCouponError("");
    const courtSubtotal = selectedCourts.reduce((s, c) => s + c.totalPriceCAD, 0);
    try {
      const res = await apiFetch<{ data: { valid: boolean; discountCAD?: number; description?: string | null; code?: string; error?: string } }>(
        "/coupons/validate",
        { method: "POST", body: JSON.stringify({ code, facilityId, subtotalCAD: courtSubtotal }) }
      );
      if (!res.data.valid) {
        setCouponError(res.data.error ?? "Invalid coupon");
      } else {
        setCouponApplied({ code: res.data.code!, description: res.data.description ?? null, discountCAD: res.data.discountCAD! });
        setCouponInput("");
      }
    } catch (e) {
      if ((e as { status?: number }).status === 401) {
        clearToken();
        pendingAction.current = handleValidateCoupon;
        setShowAuthModal(true);
        return;
      }
      setCouponError(e instanceof Error ? e.message : "Could not validate coupon");
    } finally {
      setCouponLoading(false);
    }
  }

  const courtPrice = selectedCourts.reduce((s, c) => s + c.totalPriceCAD, 0);
  const equipmentTotal = Object.entries(equipmentSelected).reduce((s, [id, qty]) => {
    const eq = equipment.find((e) => e.id === id);
    return s + (eq ? eq.priceCAD * qty : 0);
  }, 0);
  const couponDiscount = couponApplied?.discountCAD ?? 0;
  const totalPrice = Math.max(0, courtPrice + equipmentTotal - couponDiscount);

  // Credits
  const creditsAvailable = creditBalance ?? 0;
  const creditsPartialAmt = parseFloat(creditsPartialInput) || 0;
  const creditsToApply = useCredits && creditsAvailable > 0
    ? Math.min(creditsMode === "partial" ? creditsPartialAmt : creditsAvailable, totalPrice)
    : 0;
  const cardCharge = Math.max(0, Math.round((totalPrice - creditsToApply) * 100) / 100);
  const fullyByCredits = cardCharge === 0 && creditsToApply > 0;
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
          {/* Time dropdown — populated from actual available slots */}
          <select
            value={startTime ?? ""}
            onChange={(e) => setStartTime(e.target.value || null)}
            disabled={timesLoading}
            className="bg-surface border border-border rounded-dome px-3 py-2 text-sm text-white focus:outline-none focus:border-primary disabled:opacity-50"
          >
            <option value="">
              {timesLoading ? "Loading…" : availableTimes.length === 0 ? "No times available" : "Select time…"}
            </option>
            {availableTimes.map((t) => (
              <option key={t.time} value={t.time}>
                {t.label}{t.status === "PARTIAL" ? ` (${t.availableCourts} court${t.availableCourts !== 1 ? "s" : ""} left)` : ""}
              </option>
            ))}
          </select>

          {/* Duration pills — generated from venue booking rules */}
          <div className="flex gap-2 flex-wrap">
            {(bookingRules
              ? buildDurationOptions(bookingRules.minDuration, bookingRules.step, bookingRules.maxDuration)
              : FALLBACK_DURATIONS
            ).map((d) => {
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

      {/* Sport filter (shown when shared courts detected after time selection) */}
      {startTime && hasSharedCourts && allSports.length > 1 && (
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Filter by sport</p>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedSport(null)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-dome border transition-colors ${
                !selectedSport ? "bg-primary border-primary text-white" : "border-border text-muted hover:text-white"
              }`}
            >
              All sports
            </button>
            {allSports.map((s) => (
              <button
                key={s}
                onClick={() => setSelectedSport(s === selectedSport ? null : s)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-dome border transition-colors ${
                  selectedSport === s ? "bg-primary border-primary text-white" : "border-border text-muted hover:text-white"
                }`}
              >
                {SPORT_EMOJI[s.toUpperCase()] ?? ""} {s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      )}

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
                const key = courtKey(court);
                const isSelected = selectedCourts.some((c) => courtKey(c) === key);
                const emoji = SPORT_EMOJI[court.sport?.toUpperCase() ?? ""] ?? "🏟️";
                const bd = court.priceBreakdown;
                const hasPriceChange = bd !== null && bd.finalPriceCAD !== bd.basePriceCAD;
                const isDiscount = hasPriceChange && bd!.finalPriceCAD < bd!.basePriceCAD;
                const isPremium  = hasPriceChange && bd!.finalPriceCAD > bd!.basePriceCAD;
                const discountPct = isDiscount ? Math.round((1 - bd!.finalPriceCAD / bd!.basePriceCAD) * 100) : null;
                const otherSports = court.isShared
                  ? court.sports.filter((s) => s !== court.sport).map((s) => s.charAt(0) + s.slice(1).toLowerCase()).join(", ")
                  : null;

                return (
                  <button
                    key={key}
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
                    {court.isShared && (
                      <span className="absolute top-2 left-2 text-xs">🔄</span>
                    )}
                    {court.isAvailable && isDiscount && (
                      <span className={`absolute top-2 text-[10px] font-black px-1.5 py-0.5 rounded bg-green-900/70 text-green-300 ${court.isShared ? "left-7" : "left-2"}`}>
                        {discountPct}% OFF
                      </span>
                    )}
                    {court.isAvailable && isPremium && (
                      <span className={`absolute top-2 text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-900/70 text-amber-300 ${court.isShared ? "left-7" : "left-2"}`}>Peak</span>
                    )}
                    <span className="text-2xl mt-1">{emoji}</span>
                    <span className={`text-sm font-bold ${court.isAvailable ? "text-white" : "text-muted"}`}>
                      {court.name}
                    </span>
                    {court.isShared && (
                      <span className="text-[11px] text-primary font-semibold">
                        {court.sport.charAt(0) + court.sport.slice(1).toLowerCase()}
                      </span>
                    )}
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
                        {otherSports && (
                          <span className="text-muted text-[10px] mt-0.5">Also: {otherSports}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted text-xs">
                        {court.notCovered
                          ? "No slots for window"
                          : court.unavailableReason
                          ? court.unavailableReason
                          : court.bookedUntil
                          ? `Booked until ${court.bookedUntil}`
                          : "Unavailable"}
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

      {/* Equipment upsell */}
      {canBook && !recurringOn && equipment.length > 0 && (
        <div className="bg-surface border border-border rounded-dome p-4 space-y-1">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">🎒 Add Equipment (Optional)</p>
          {equipment.map((item) => {
            const qty = equipmentSelected[item.id] ?? 0;
            const soldOut = item.availableQuantity === 0;
            const emoji = SPORT_EMOJI[item.sport.toUpperCase()] ?? "🎒";
            return (
              <div key={item.id} className={`flex items-center justify-between py-2 border-b border-border last:border-0 ${soldOut ? "opacity-40" : ""}`}>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-lg">{emoji}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                    {item.description && <p className="text-xs text-muted truncate">{item.description}</p>}
                    {soldOut
                      ? <p className="text-xs text-red-400 font-semibold">Sold out</p>
                      : <p className="text-xs text-primary font-bold">C${item.priceCAD.toFixed(2)} / session</p>
                    }
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <button
                    onClick={() => setEquipmentSelected((p) => { const n = {...p}; if (qty <= 1) delete n[item.id]; else n[item.id] = qty - 1; return n; })}
                    disabled={qty === 0 || soldOut}
                    className="w-7 h-7 rounded-full bg-black border border-border text-white text-lg font-bold flex items-center justify-center disabled:opacity-30 hover:border-primary/50 transition-colors"
                  >−</button>
                  <span className="text-sm font-bold text-white w-4 text-center">{qty}</span>
                  <button
                    onClick={() => setEquipmentSelected((p) => ({...p, [item.id]: Math.min(item.availableQuantity, qty + 1)}))}
                    disabled={soldOut || qty >= item.availableQuantity}
                    className="w-7 h-7 rounded-full bg-black border border-border text-white text-lg font-bold flex items-center justify-center disabled:opacity-30 hover:border-primary/50 transition-colors"
                  >+</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Credits — shown when courts are selected and user has balance */}
      {canBook && !recurringOn && creditsAvailable > 0 && (
        <div className="bg-surface border border-border rounded-dome p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wide">💳 Dome Credits</p>
              <p className="text-sm font-bold text-green-400 mt-0.5">C${creditsAvailable.toFixed(2)} available</p>
            </div>
            <button
              onClick={() => setUseCredits((v) => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors ${useCredits ? "bg-primary" : "bg-border"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${useCredits ? "translate-x-5" : ""}`} />
            </button>
          </div>

          {useCredits && (
            <>
              {/* Mode */}
              <div className="flex gap-2">
                {(["all", "partial"] as const).map((m) => (
                  <button key={m} onClick={() => setCreditsMode(m)}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-dome border transition-colors ${creditsMode === m ? "bg-primary border-primary text-white" : "border-border text-muted hover:text-white"}`}>
                    {m === "all" ? `Use all (C$${Math.min(creditsAvailable, totalPrice).toFixed(2)})` : "Use partial"}
                  </button>
                ))}
              </div>

              {creditsMode === "partial" && (
                <div className="flex items-center gap-2">
                  <span className="text-muted text-sm">C$</span>
                  <input
                    type="number"
                    min="0.01"
                    max={Math.min(creditsAvailable, totalPrice)}
                    step="0.01"
                    placeholder="Amount to use"
                    value={creditsPartialInput}
                    onChange={(e) => setCreditsPartialInput(e.target.value)}
                    className="flex-1 bg-black border border-border rounded-dome px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                  />
                </div>
              )}

              {/* Split preview */}
              <div className="bg-green-950/30 border border-green-900/40 rounded-dome px-3 py-2.5 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">💳 Credits applied</span>
                  <span className="text-green-400 font-semibold">−C${creditsToApply.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">{fullyByCredits ? "✅ Card charge" : "Card charge"}</span>
                  <span className={`font-semibold ${fullyByCredits ? "text-green-400" : "text-white"}`}>
                    C${cardCharge.toFixed(2)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Coupon input — shown when courts are selected */}
      {canBook && !recurringOn && (
        <div className="bg-surface border border-border rounded-dome p-4 space-y-2">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">🎟️ Coupon</p>
          {couponApplied ? (
            <div className="flex items-center justify-between bg-green-950/40 border border-green-900/50 rounded-dome px-3 py-2.5">
              <div>
                <p className="text-sm font-bold text-green-400 font-mono">{couponApplied.code}</p>
                {couponApplied.description && <p className="text-xs text-muted mt-0.5">{couponApplied.description}</p>}
                <p className="text-xs text-green-400 font-semibold mt-0.5">−C${couponApplied.discountCAD.toFixed(2)} saved</p>
              </div>
              <button onClick={() => { setCouponApplied(null); setCouponError(""); }}
                className="text-xs text-muted hover:text-white transition-colors ml-4">
                ✕ Remove
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter coupon code..."
                value={couponInput}
                onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") void handleValidateCoupon(); }}
                className="flex-1 bg-black border border-border rounded-dome px-3 py-2 text-sm text-white placeholder:text-muted font-mono tracking-widest focus:outline-none focus:border-primary"
              />
              <button
                onClick={handleValidateCoupon}
                disabled={!couponInput.trim() || couponLoading}
                className="px-4 py-2 text-sm font-semibold bg-primary hover:bg-primary-hover disabled:opacity-40 text-white rounded-dome transition-colors"
              >
                {couponLoading ? "…" : "Apply"}
              </button>
            </div>
          )}
          {couponError && <p className="text-xs text-red-400">{couponError}</p>}
        </div>
      )}

      {/* CTA */}
      {canBook && (
        <div className="border-t border-border pt-4 space-y-2">
          {/* Live price breakdown */}
          <div className="bg-black rounded-dome px-4 py-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted">Court{selectedCourts.length > 1 ? "s" : ""}</span>
              <span className="text-white">C${courtPrice.toFixed(2)}</span>
            </div>
            {equipmentTotal > 0 && (
              <div className="flex justify-between">
                <span className="text-muted">Equipment</span>
                <span className="text-white">C${equipmentTotal.toFixed(2)}</span>
              </div>
            )}
            {couponDiscount > 0 && (
              <div className="flex justify-between">
                <span className="text-green-400">Coupon ({couponApplied?.code})</span>
                <span className="text-green-400">−C${couponDiscount.toFixed(2)}</span>
              </div>
            )}
            {creditsToApply > 0 && (
              <div className="flex justify-between">
                <span className="text-green-400">💳 Credits</span>
                <span className="text-green-400">−C${creditsToApply.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold border-t border-border pt-1 mt-1">
              <span className="text-white">{recurringOn ? (recurringPayModel === "PAY_UPFRONT" ? "Total upfront" : "First session") : "Total (excl. tax)"}</span>
              <span className="text-primary">
                {recurringOn
                  ? `C$${recurringPayModel === "PAY_UPFRONT" ? recurringTotal.toFixed(2) : totalPrice.toFixed(2)}`
                  : creditsToApply > 0
                  ? `C$${cardCharge.toFixed(2)}`
                  : `C$${totalPrice.toFixed(2)}`}
              </span>
            </div>
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
              : fullyByCredits
              ? `✅ Confirm Booking — Pay C$0.00 💳`
              : creditsToApply > 0
              ? `Pay C$${cardCharge.toFixed(2)} by Card`
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

      {/* Auth modal — shown when unauthenticated user tries to book */}
      {showAuthModal && (
        <AuthModal
          onSuccess={onAuthSuccess}
          onClose={() => { setShowAuthModal(false); pendingAction.current = null; }}
        />
      )}
    </div>
  );
}
