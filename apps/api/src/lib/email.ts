import sgMail from "@sendgrid/mail";

if (process.env["SENDGRID_API_KEY"]) {
  sgMail.setApiKey(process.env["SENDGRID_API_KEY"]);
}

const FROM = {
  email: process.env["SENDGRID_FROM_EMAIL"] ?? "noreply@dome.app",
  name:  process.env["SENDGRID_FROM_NAME"]  ?? "Dome Sports",
};

const PRIMARY   = "#E85068";
const BG        = "#f4f4f4";
const CARD_BG   = "#ffffff";
const TEXT_DARK = "#111111";
const TEXT_MUTED= "#666666";
const VENDOR_URL = "https://dome-vendor.vercel.app";
const APP_URL    = "https://dome.app";

// ─── Base template ────────────────────────────────────────────────────────────

function base(content: string, cta?: { label: string; href: string }): string {
  const ctaBlock = cta
    ? `<tr><td align="center" style="padding:24px 0 8px;">
        <a href="${cta.href}"
           style="background:${PRIMARY};color:#fff;text-decoration:none;font-weight:700;
                  font-size:15px;padding:14px 32px;border-radius:8px;display:inline-block;">
          ${cta.label}
        </a>
       </td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Dome</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:24px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

        <!-- Header -->
        <tr>
          <td style="background:#000;border-radius:10px 10px 0 0;padding:20px 28px;">
            <span style="color:#fff;font-size:22px;font-weight:900;letter-spacing:3px;">DOME</span>
            <span style="color:${PRIMARY};font-size:11px;font-weight:700;
                         letter-spacing:1px;margin-left:10px;vertical-align:middle;">SPORTS</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:${CARD_BG};padding:28px 28px 8px;border-left:1px solid #e8e8e8;border-right:1px solid #e8e8e8;">
            ${content}
            ${ctaBlock}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9f9f9;border:1px solid #e8e8e8;border-top:none;
                     border-radius:0 0 10px 10px;padding:16px 28px;text-align:center;">
            <p style="margin:0 0 6px;color:${TEXT_MUTED};font-size:12px;">
              Dome Sports &middot; <a href="${APP_URL}" style="color:${PRIMARY};text-decoration:none;">${APP_URL}</a>
            </p>
            <p style="margin:0;color:#aaa;font-size:11px;">
              &copy; ${new Date().getFullYear()} Dome Sports Inc. &middot;
              <a href="${APP_URL}/unsubscribe" style="color:#aaa;">Unsubscribe</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;color:${TEXT_MUTED};font-size:14px;width:40%;">${label}</td>
    <td style="padding:6px 0;color:${TEXT_DARK};font-size:14px;font-weight:600;">${value}</td>
  </tr>`;
}

function hr(): string {
  return `<tr><td colspan="2" style="padding:8px 0;">
    <hr style="border:none;border-top:1px solid #eee;margin:0;"/>
  </td></tr>`;
}

function heading(text: string): string {
  return `<h2 style="margin:0 0 20px;color:${TEXT_DARK};font-size:20px;font-weight:800;">${text}</h2>`;
}

function para(text: string, muted = false): string {
  return `<p style="margin:0 0 14px;color:${muted ? TEXT_MUTED : TEXT_DARK};font-size:14px;line-height:1.6;">${text}</p>`;
}

// Safe send — never throws, so callers don't need try/catch
async function send(to: string, subject: string, html: string): Promise<void> {
  if (!process.env["SENDGRID_API_KEY"]) return;
  try {
    await sgMail.send({ to, from: FROM, subject, html });
  } catch (err) {
    console.error("[email] send failed:", (err as Error).message ?? err);
  }
}

// ─── Exported send functions ──────────────────────────────────────────────────

export interface BookingConfirmationData {
  bookingId: string;
  facilityName: string;
  facilityAddress: string;
  sport: string;
  courtName?: string | null;
  date: string;          // "Saturday, June 7 2026"
  startTime: string;     // "7:00 PM"
  endTime: string;       // "8:00 PM"
  durationMinutes: number;
  subtotalCAD: number;
  taxCAD: number;
  totalCAD: number;
  cancelDeadline: string; // "Jun 6 at 7:00 PM"
}

export async function sendBookingConfirmation(to: string | null | undefined, data: BookingConfirmationData): Promise<void> {
  if (!to) return;
  const sportLabel = data.sport.charAt(0).toUpperCase() + data.sport.slice(1).toLowerCase();

  const content = `
    ${heading("Your booking is confirmed! ✅")}
    <p style="margin:0 0 20px;font-size:22px;">${sportEmoji(data.sport)}</p>
    <h3 style="margin:0 0 4px;color:${TEXT_DARK};font-size:18px;font-weight:800;">${data.facilityName}</h3>
    <p style="margin:0 0 20px;color:${TEXT_MUTED};font-size:13px;">📍 ${data.facilityAddress}</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      ${row("Sport",  `${sportEmoji(data.sport)} ${sportLabel}`)}
      ${row("Date",   `📅 ${data.date}`)}
      ${row("Time",   `⏰ ${data.startTime} — ${data.endTime} (${data.durationMinutes} min)`)}
      ${data.courtName ? row("Court", `🎾 ${data.courtName}`) : ""}
      ${hr()}
      <tr><td colspan="2" style="padding:8px 0 4px;color:${TEXT_MUTED};font-size:12px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;">Payment</td></tr>
      ${row("Subtotal", `C$${data.subtotalCAD.toFixed(2)}`)}
      ${row("Tax",      `C$${data.taxCAD.toFixed(2)}`)}
      ${row("Total",    `<strong style="color:${PRIMARY};">C$${data.totalCAD.toFixed(2)}</strong>`)}
      ${hr()}
      ${row("Booking ID", `#${data.bookingId.slice(0, 12)}…`)}
    </table>

    ${para(`Need to cancel? You have until <strong>${data.cancelDeadline}</strong> for a full refund.`, true)}
  `;

  await send(
    to,
    `Booking Confirmed ✅ — ${data.facilityName} ${data.date}`,
    base(content, { label: "View Booking", href: `${APP_URL}/bookings` })
  );
}

export interface BookingCancellationData {
  bookingId: string;
  facilityName: string;
  date: string;
  startTime: string;
  endTime: string;
  refundType: "full" | "credits" | "none";
  refundAmountCAD: number;
}

export async function sendBookingCancellation(to: string | null | undefined, data: BookingCancellationData): Promise<void> {
  if (!to) return;

  const refundLine =
    data.refundType === "full"
      ? `<strong>C$${data.refundAmountCAD.toFixed(2)}</strong> will be returned to your original payment method within 5–10 business days.`
      : data.refundType === "credits"
      ? `<strong>C$${data.refundAmountCAD.toFixed(2)}</strong> has been added as Dome Credits to your wallet.`
      : "No refund applies for this cancellation.";

  const content = `
    ${heading("Booking Cancelled")}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      ${row("Facility", `<span style="text-decoration:line-through;color:${TEXT_MUTED};">${data.facilityName}</span>`)}
      ${row("Date",     `<span style="text-decoration:line-through;color:${TEXT_MUTED};">${data.date}</span>`)}
      ${row("Time",     `<span style="text-decoration:line-through;color:${TEXT_MUTED};">${data.startTime} — ${data.endTime}</span>`)}
    </table>
    <div style="background:#fff8f0;border-left:3px solid ${PRIMARY};padding:12px 16px;border-radius:0 6px 6px 0;margin-bottom:20px;">
      <p style="margin:0;font-size:14px;color:${TEXT_DARK};">💳 Refund: ${refundLine}</p>
    </div>
  `;

  await send(
    to,
    "Booking Cancelled — Refund Initiated",
    base(content, { label: "Book Another Court", href: `${APP_URL}/facilities` })
  );
}

export interface VendorBookingNotificationData {
  playerFirstName: string;
  facilityName: string;
  courtName?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  amountEarnedCAD: number;
}

export async function sendVendorBookingNotification(to: string | null | undefined, data: VendorBookingNotificationData): Promise<void> {
  if (!to) return;

  const content = `
    ${heading(`New Booking at ${data.facilityName} 📅`)}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      ${row("Player", data.playerFirstName)}
      ${data.courtName ? row("Court", data.courtName) : ""}
      ${row("Date",   data.date)}
      ${row("Time",   `${data.startTime} — ${data.endTime}`)}
      ${hr()}
      ${row("You earn", `<strong style="color:#22c55e;">C$${data.amountEarnedCAD.toFixed(2)}</strong>`)}
    </table>
  `;

  await send(
    to,
    `New Booking at ${data.facilityName} 📅`,
    base(content, { label: "View in Vendor Portal", href: `${VENDOR_URL}/dashboard/bookings` })
  );
}

export async function sendOTP(to: string | null | undefined, code: string): Promise<void> {
  if (!to) return;

  const content = `
    ${heading("Your verification code")}
    <div style="text-align:center;margin:24px 0;">
      <span style="display:inline-block;background:#f4f4f4;border:2px dashed ${PRIMARY};
                   border-radius:12px;padding:18px 36px;font-size:36px;font-weight:900;
                   letter-spacing:8px;color:${TEXT_DARK};">
        ${code}
      </span>
    </div>
    ${para("This code expires in <strong>10 minutes</strong>.", false)}
    ${para("If you didn't request this, you can safely ignore this email.", true)}
  `;

  await send(to, `Your Dome verification code: ${code}`, base(content));
}

export interface RecurringSeriesData {
  facilityName: string;
  sport: string;
  courtName: string;
  startTime: string;
  endTime: string;
  frequency: string;        // "WEEKLY" | "BIWEEKLY"
  upcomingDates: string[];  // formatted date strings, up to 8
  paymentModel: string;     // "PAY_UPFRONT" | "PAY_PER_SESSION"
  totalCAD?: number;
  discountPercent?: number;
  totalSessions: number;
}

export async function sendRecurringSeriesConfirmation(to: string | null | undefined, data: RecurringSeriesData): Promise<void> {
  if (!to) return;
  const freqLabel = data.frequency === "BIWEEKLY" ? "Biweekly" : "Weekly";
  const sportLabel = data.sport.charAt(0).toUpperCase() + data.sport.slice(1).toLowerCase();

  const datesHtml = data.upcomingDates.slice(0, 8)
    .map((d) => `<li style="padding:3px 0;color:${TEXT_DARK};font-size:14px;">${d}</li>`)
    .join("");

  const paymentNote = data.paymentModel === "PAY_UPFRONT"
    ? `Paid upfront: <strong style="color:${PRIMARY};">C$${data.totalCAD?.toFixed(2) ?? "—"}</strong>${data.discountPercent ? ` (${data.discountPercent}% discount applied)` : ""}`
    : "Billed per session before each game";

  const content = `
    ${heading("Recurring Booking Confirmed 🔄")}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      ${row("Facility", data.facilityName)}
      ${row("Sport",    `${sportEmoji(data.sport)} ${sportLabel}`)}
      ${row("Court",    data.courtName)}
      ${row("Schedule", `${freqLabel} · ${data.startTime} — ${data.endTime}`)}
      ${row("Sessions", String(data.totalSessions))}
      ${hr()}
      ${row("Payment", paymentNote)}
    </table>
    <p style="margin:0 0 8px;color:${TEXT_MUTED};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">
      Upcoming Sessions
    </p>
    <ul style="margin:0 0 20px;padding-left:20px;">${datesHtml}</ul>
  `;

  await send(
    to,
    `Recurring Booking Confirmed 🔄 — ${data.facilityName}`,
    base(content, { label: "Manage Recurring Bookings", href: `${APP_URL}/bookings` })
  );
}

export interface BookingReminderData {
  facilityName: string;
  facilityAddress: string;
  sport: string;
  date: string;
  startTime: string;
  endTime: string;
  mapsUrl?: string;
  bookingId: string;
}

export async function sendBookingReminder(to: string | null | undefined, data: BookingReminderData): Promise<void> {
  if (!to) return;

  const content = `
    ${heading("Your game is tomorrow! 🏸")}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      ${row("Facility", data.facilityName)}
      ${row("Address",  `📍 ${data.facilityAddress}`)}
      ${row("Date",     data.date)}
      ${row("Time",     `${data.startTime} — ${data.endTime}`)}
    </table>
    ${para("Get there early, warm up, and have a great game! 💪")}
    ${data.mapsUrl ? `<p style="margin:0 0 20px;"><a href="${data.mapsUrl}" style="color:${PRIMARY};font-size:14px;font-weight:600;">📍 Open in Google Maps →</a></p>` : ""}
    ${para(`Need to cancel? <a href="${APP_URL}/bookings" style="color:${PRIMARY};">Manage booking</a>`, true)}
  `;

  await send(
    to,
    "Reminder: Your game is tomorrow! 🏸",
    base(content, { label: "Get Directions", href: data.mapsUrl ?? `${APP_URL}/bookings` })
  );
}

export interface ReviewRequestData {
  facilityName: string;
  sport: string;
  date: string;
  bookingId: string;
}

export async function sendReviewRequest(to: string | null | undefined, data: ReviewRequestData): Promise<void> {
  if (!to) return;

  const content = `
    ${heading(`How was your game at ${data.facilityName}? ⭐`)}
    ${para(`Thanks for playing ${data.sport.toLowerCase()} on ${data.date}! Your feedback helps other players find great courts.`)}
    <p style="margin:0 0 8px;color:${TEXT_MUTED};font-size:13px;">Quick rating:</p>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        ${[1,2,3,4,5].map((n) =>
          `<td style="padding-right:6px;">
            <a href="${APP_URL}/review?bookingId=${data.bookingId}&rating=${n}"
               style="display:inline-block;background:#f4f4f4;border-radius:8px;
                      padding:10px 14px;text-decoration:none;font-size:20px;">
              ${"★"}
            </a>
           </td>`
        ).join("")}
      </tr>
    </table>
  `;

  await send(
    to,
    `How was your game at ${data.facilityName}? ⭐`,
    base(content, { label: "Write a Full Review", href: `${APP_URL}/review?bookingId=${data.bookingId}` })
  );
}

export interface VendorApplicationData {
  vendorFirstName: string;
  businessName: string;
  businessEmail: string;
  city: string;
  province: string;
  sports: string[];
}

export async function sendVendorApplicationReceived(to: string | null | undefined, data: VendorApplicationData): Promise<void> {
  if (!to) return;

  const content = `
    ${heading("Application Received 📬")}
    ${para(`Hi ${data.vendorFirstName}, thanks for applying to become a Dome vendor!`)}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      ${row("Business",  data.businessName)}
      ${row("Location",  `${data.city}, ${data.province}`)}
      ${row("Sports",    data.sports.map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join(", "))}
    </table>
    ${para("We'll review your application within <strong>24–48 hours</strong>. You'll receive an email with our decision.")}
    ${para('Questions? <a href="mailto:support@dome.app" style="color:' + PRIMARY + ';">Contact support@dome.app</a>', true)}
  `;

  await send(to, "Application Received — Dome Vendor Portal", base(content));
}

export interface VendorApprovalData {
  vendorFirstName: string;
  businessName: string;
}

export async function sendVendorApplicationApproved(to: string | null | undefined, data: VendorApprovalData): Promise<void> {
  if (!to) return;

  const steps = ["Set up your facility profile", "Add your courts", "Generate slots", "Start accepting bookings!"]
    .map((s, i) => `<li style="padding:4px 0;font-size:14px;color:${TEXT_DARK};"><strong>${i+1}.</strong> ${s}</li>`)
    .join("");

  const content = `
    ${heading(`You're approved! Welcome to Dome 🎉`)}
    ${para(`Congratulations, ${data.vendorFirstName}! <strong>${data.businessName}</strong> is now live on Dome.`)}
    <p style="margin:0 0 8px;color:${TEXT_MUTED};font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">
      Quick Start
    </p>
    <ol style="margin:0 0 20px;padding-left:24px;">${steps}</ol>
    ${para("Login to your vendor portal to get started — your first bookings could be hours away! 🏟️")}
  `;

  await send(
    to,
    "You're approved! Welcome to Dome 🎉",
    base(content, { label: "Open Vendor Portal", href: VENDOR_URL })
  );
}

export interface VendorRejectionData {
  vendorFirstName: string;
  reason: string;
}

export async function sendVendorApplicationRejected(to: string | null | undefined, data: VendorRejectionData): Promise<void> {
  if (!to) return;

  const content = `
    ${heading("Dome Vendor Application Update")}
    ${para(`Hi ${data.vendorFirstName}, thank you for your interest in Dome.`)}
    ${para("After reviewing your application, we're unable to approve it at this time.")}
    <div style="background:#fff8f0;border-left:3px solid #f59e0b;padding:12px 16px;border-radius:0 6px 6px 0;margin-bottom:20px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:${TEXT_MUTED};text-transform:uppercase;letter-spacing:.5px;">Reason</p>
      <p style="margin:0;font-size:14px;color:${TEXT_DARK};">${data.reason}</p>
    </div>
    ${para('You may reapply after addressing these concerns. Questions? <a href="mailto:support@dome.app" style="color:' + PRIMARY + ';">support@dome.app</a>', true)}
  `;

  await send(to, "Dome Vendor Application Update", base(content));
}

export interface AvailabilityAlertData {
  facilityName: string;
  sport: string;
  date: string;
  startTime: string;
  endTime: string;
  facilityId: string;
  slotDate: string;   // YYYY-MM-DD for deep link
}

export async function sendAvailabilityAlert(to: string | null | undefined, data: AvailabilityAlertData): Promise<void> {
  if (!to) return;

  const content = `
    ${heading("Court Available Now! 🎾")}
    ${para(`Good news! A court just opened up at <strong>${data.facilityName}</strong>.`)}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      ${row("Facility", data.facilityName)}
      ${row("Sport",    `${sportEmoji(data.sport)} ${data.sport.charAt(0).toUpperCase() + data.sport.slice(1).toLowerCase()}`)}
      ${row("Date",     data.date)}
      ${row("Time",     `${data.startTime} — ${data.endTime}`)}
    </table>
    <div style="text-align:center;margin-bottom:16px;">
      <p style="margin:0;color:${TEXT_MUTED};font-size:13px;font-style:italic;">
        ⚡ This slot may fill up quickly — book now!
      </p>
    </div>
  `;

  await send(
    to,
    `Court Available Now! 🎾 ${data.facilityName} ${data.date}`,
    base(content, { label: "Book Now", href: `${APP_URL}/facilities/${data.facilityId}` })
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function sportEmoji(sport: string): string {
  const map: Record<string, string> = {
    badminton: "🏸", tennis: "🎾", basketball: "🏀", soccer: "⚽",
    football: "🏈", cricket: "🏏", bowling: "🎳", golf: "⛳",
    volleyball: "🏐", hockey: "🏒", squash: "🏸", pickleball: "🥒",
    baseball: "⚾",
  };
  return map[sport.toLowerCase()] ?? "🏟️";
}
