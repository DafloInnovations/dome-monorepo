import twilio from "twilio";
import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis";
import { generateRefreshToken, signAccessToken } from "../lib/jwt";
import type { User } from "@prisma/client";

const twilioClient = twilio(
  process.env["TWILIO_ACCOUNT_SID"]!,
  process.env["TWILIO_AUTH_TOKEN"]!
);

const OTP_TTL_SECONDS = 300;       // 5 min
const OTP_MAX_ATTEMPTS = 3;
const RATE_LIMIT_TTL = 600;        // 10 min
const RATE_LIMIT_MAX = 3;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const local =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (local.length !== 10) {
    throw Object.assign(new Error("Invalid Canadian phone number."), { status: 400 });
  }
  return `+1${local}`;
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ─── Send OTP ─────────────────────────────────────────────────────────────────

const TEST_MODE = process.env["TEST_MODE"] === "true";
const TEST_OTP_BYPASS = "000000";

export async function sendOtp(rawPhone: string): Promise<void> {
  const phone = normalizePhone(rawPhone);

  // TEST_MODE: skip Twilio and rate limiting; any number works with code 000000
  if (TEST_MODE) {
    await redis.setex(`otp:${phone}`, OTP_TTL_SECONDS, JSON.stringify({ code: TEST_OTP_BYPASS, attempts: 0 }));
    console.log(`[TEST_MODE] OTP bypass active — use code ${TEST_OTP_BYPASS} for ${phone}`);
    return;
  }

  // Rate limit: max 3 sends per 10 minutes per number
  const rateLimitKey = `otp_rate:${phone}`;
  const count = await redis.incr(rateLimitKey);
  if (count === 1) await redis.expire(rateLimitKey, RATE_LIMIT_TTL);
  if (count > RATE_LIMIT_MAX) {
    throw Object.assign(
      new Error("Too many verification requests. Try again in 10 minutes."),
      { status: 429 }
    );
  }

  const otp = generateOtp();
  await redis.setex(
    `otp:${phone}`,
    OTP_TTL_SECONDS,
    JSON.stringify({ code: otp, attempts: 0 })
  );

  if (process.env["NODE_ENV"] === "development") {
    console.log(`\n  ┌─── OTP (dev) ─────────────────────\n  │  ${phone}  →  ${otp}\n  └───────────────────────────────────\n`);
    return;
  }

  const fromNumber = `+1${process.env["TWILIO_PHONE_NUMBER"]!.replace(/\D/g, "")}`;
  await twilioClient.messages.create({
    body: `Your Dome verification code is ${otp}. It expires in 5 minutes. Do not share it.`,
    from: fromNumber,
    to: phone,
  });
}

// ─── Verify OTP ───────────────────────────────────────────────────────────────

export async function verifyOtp(
  rawPhone: string,
  code: string
): Promise<{ accessToken: string; refreshToken: string; user: User; isNewUser: boolean; vendorStatus: "APPROVED" | "PENDING" | "REJECTED" | "NONE" }> {
  const phone = normalizePhone(rawPhone);
  const otpKey = `otp:${phone}`;

  const stored = await redis.get(otpKey);
  if (!stored) {
    throw Object.assign(
      new Error("Code expired or not found. Request a new one."),
      { status: 400 }
    );
  }

  const { code: storedCode, attempts } = JSON.parse(stored) as {
    code: string;
    attempts: number;
  };

  if (attempts >= OTP_MAX_ATTEMPTS) {
    await redis.del(otpKey);
    throw Object.assign(
      new Error("Too many incorrect attempts. Request a new code."),
      { status: 400 }
    );
  }

  if (code !== storedCode) {
    await redis.setex(
      otpKey,
      OTP_TTL_SECONDS,
      JSON.stringify({ code: storedCode, attempts: attempts + 1 })
    );
    const remaining = OTP_MAX_ATTEMPTS - attempts - 1;
    throw Object.assign(
      new Error(`Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`),
      { status: 400 }
    );
  }

  await redis.del(otpKey);

  const existing = await prisma.user.findUnique({ where: { phone } });
  const isNewUser = !existing;

  const user = await prisma.user.upsert({
    where: { phone },
    create: { phone, isPhoneVerified: true },
    update: { isPhoneVerified: true },
  });

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const rawRefreshToken = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      token: rawRefreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });

  const vendor = await prisma.vendor.findUnique({
    where: { userId: user.id },
    select: { status: true },
  });

  let vendorStatus: "APPROVED" | "PENDING" | "REJECTED" | "NONE";
  if (!vendor) {
    vendorStatus = "NONE";
  } else if (vendor.status === "APPROVED") {
    vendorStatus = "APPROVED";
  } else if (vendor.status === "PENDING") {
    vendorStatus = "PENDING";
  } else if (vendor.status === "REJECTED") {
    vendorStatus = "REJECTED";
  } else {
    vendorStatus = "NONE";
  }

  return { accessToken, refreshToken: rawRefreshToken, user, isNewUser, vendorStatus };
}

// ─── Refresh ──────────────────────────────────────────────────────────────────

export async function refreshAccessToken(
  rawRefreshToken: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const stored = await prisma.refreshToken.findUnique({
    where: { token: rawRefreshToken },
    include: { user: { select: { id: true, role: true } } },
  });

  if (!stored || stored.expiresAt < new Date()) {
    if (stored) await prisma.refreshToken.delete({ where: { id: stored.id } });
    throw Object.assign(new Error("Session expired. Please sign in again."), { status: 401 });
  }

  // Rotate: delete old, issue new
  const newRawRefreshToken = generateRefreshToken();
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: {
      token: newRawRefreshToken,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });

  const accessToken = signAccessToken({ sub: stored.user.id, role: stored.user.role });
  return { accessToken, refreshToken: newRawRefreshToken };
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function logout(rawRefreshToken: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { token: rawRefreshToken } });
}
