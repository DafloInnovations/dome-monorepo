import { expireOldAlerts } from "../services/alerts.service";

export async function runExpireAlerts(): Promise<void> {
  console.log("[Alerts] Expiring stale alerts…");
  try {
    const count = await expireOldAlerts();
    console.log(`[Alerts] Expired ${count} alert(s).`);
  } catch (err) {
    console.error("[Alerts] expireOldAlerts failed:", err);
  }
}
