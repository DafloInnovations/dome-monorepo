import twilio from "twilio";

const client =
  process.env["TWILIO_ACCOUNT_SID"] && process.env["TWILIO_AUTH_TOKEN"]
    ? twilio(process.env["TWILIO_ACCOUNT_SID"], process.env["TWILIO_AUTH_TOKEN"])
    : null;

const FROM = process.env["TWILIO_PHONE_NUMBER"] ?? "";

export async function sendSms(to: string, body: string): Promise<void> {
  if (!client || !FROM) {
    console.warn("[Twilio] Not configured — skipping SMS to", to);
    return;
  }
  try {
    await client.messages.create({ from: FROM, to, body });
  } catch (err) {
    console.error("[Twilio] SMS failed:", (err as Error).message);
  }
}
