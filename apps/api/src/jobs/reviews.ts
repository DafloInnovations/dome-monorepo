import { BookingStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { sendPushNotification, saveNotification } from "../lib/firebase";
import { sendReviewRequest } from "../lib/email";

// Runs daily — push prompts for yesterday's confirmed bookings with no review.
export async function sendReviewPrompts(): Promise<void> {
  console.log("[Reviews] Sending review prompts…");
  try {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const dayStr = yesterday.toISOString().split("T")[0]!;
    const dayDate = new Date(dayStr + "T00:00:00.000Z");
    const nextDay = new Date(dayStr + "T00:00:00.000Z");
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    const bookings = await prisma.booking.findMany({
      where: {
        status: BookingStatus.CONFIRMED,
        slot: { date: { gte: dayDate, lt: nextDay } },
        review: null,
      },
      include: {
        user: { select: { id: true, deviceToken: true } },
        facility: { select: { name: true, sport: true } },
      },
      take: 500,
    });

    let sent = 0;
    for (const booking of bookings) {
      const sport = booking.facility.sport.charAt(0).toUpperCase() + booking.facility.sport.slice(1).toLowerCase();
      const title = "How was your game? ⭐";
      const body = `Rate your ${sport} experience at ${booking.facility.name}`;
      const data = { type: "REVIEW_PROMPT", bookingId: booking.id };
      await saveNotification(booking.user.id, "BOOKING_CONFIRMED", title, body, data);
      if (booking.user.deviceToken) {
        await sendPushNotification(booking.user.deviceToken, title, body, data);
        sent++;
      }
    }
    console.log(`[Reviews] Sent ${sent} review prompt(s) for ${bookings.length} eligible booking(s).`);
  } catch (err) {
    console.error("[Reviews] sendReviewPrompts failed:", err);
  }
}

// Runs hourly — send email review requests 2 hours after slot end time.
export async function sendEmailReviewRequests(): Promise<void> {
  console.log("[Reviews] Sending email review requests…");
  try {
    const now = new Date();
    // Window: slots that ended between 2h and 3h ago (hourly run catches each once)
    const threeHoursAgo = new Date(now.getTime() - 3 * 3_600_000);
    const twoHoursAgo   = new Date(now.getTime() - 2 * 3_600_000);

    // Find dates in the window
    const windowDateStr = threeHoursAgo.toISOString().split("T")[0]!;
    const todayDateStr  = now.toISOString().split("T")[0]!;

    const bookings = await prisma.booking.findMany({
      where: {
        status: BookingStatus.CONFIRMED,
        review: null,
        slot: {
          date: {
            gte: new Date(windowDateStr + "T00:00:00.000Z"),
            lte: new Date(todayDateStr + "T23:59:59.999Z"),
          },
        },
      },
      include: {
        user: { select: { id: true, email: true, emailBookingConfirmation: true } },
        slot: { select: { date: true, endTime: true } },
        facility: { select: { name: true, sport: true } },
      },
      take: 200,
    });

    let sent = 0;
    for (const booking of bookings) {
      if (!booking.user.email || !booking.user.emailBookingConfirmation) continue;

      // Compute exact slot end datetime in UTC
      const slotDate = booking.slot!.date instanceof Date
        ? booking.slot!.date
        : new Date(booking.slot!.date);
      const [eh, em] = booking.slot!.endTime.split(":").map(Number);
      const slotEndMs = Date.UTC(
        slotDate.getUTCFullYear(),
        slotDate.getUTCMonth(),
        slotDate.getUTCDate(),
        eh!, em!
      );

      if (slotEndMs < threeHoursAgo.getTime() || slotEndMs > twoHoursAgo.getTime()) continue;

      const dateLabel = slotDate.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
      await sendReviewRequest(booking.user.email, {
        facilityName: booking.facility.name,
        sport: booking.facility.sport,
        date: dateLabel,
        bookingId: booking.id,
      });
      sent++;
    }
    console.log(`[Reviews] Sent ${sent} email review request(s).`);
  } catch (err) {
    console.error("[Reviews] sendEmailReviewRequests failed:", err);
  }
}
