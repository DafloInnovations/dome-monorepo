import { BookingStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { sendPushNotification, saveNotification } from "../lib/firebase";

export async function sendBookingReminders(): Promise<void> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const nextDay = new Date(tomorrow);
  nextDay.setDate(nextDay.getDate() + 1);

  const bookings = await prisma.booking.findMany({
    where: {
      status: BookingStatus.CONFIRMED,
      slot: {
        date: { gte: tomorrow, lt: nextDay },
      },
    },
    include: {
      user: { select: { deviceToken: true } },
      slot: { select: { startTime: true } },
      facility: { select: { name: true, sport: true } },
    },
  });

  for (const booking of bookings) {
    const sport =
      booking.facility.sport.charAt(0) +
      booking.facility.sport.slice(1).toLowerCase();
    const rTitle = "Game Tomorrow! 🏟️";
    const rBody = `${sport} at ${booking.facility.name} at ${booking.slot.startTime}`;
    const rData = { type: "booking_reminder", bookingId: booking.id };
    await saveNotification(booking.userId, "BOOKING_REMINDER", rTitle, rBody, rData);
    if (!booking.user.deviceToken) continue;
    await sendPushNotification(booking.user.deviceToken, rTitle, rBody, rData);
  }

  console.log(`[reminders] sent ${bookings.length} booking reminder(s)`);
}
