import { processUpcomingRecurringBookings } from "../services/recurring.service";

export async function runRecurringBookings(): Promise<void> {
  console.log("[Recurring] Processing upcoming bookings…");
  try {
    await processUpcomingRecurringBookings();
    console.log("[Recurring] Done.");
  } catch (err) {
    console.error("[Recurring] Error:", err);
  }
}
