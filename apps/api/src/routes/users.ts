import { Router } from "express";
import { z } from "zod";
import { BookingStatus, Province } from "@prisma/client";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { prisma } from "../lib/prisma";

const router = Router();

const userAvatarSchema = z.string().refine(
  (value) =>
    /^https?:\/\//i.test(value) ||
    /^data:image\/(png|jpe?g|webp);base64,/i.test(value),
  "Avatar must be a URL or uploaded image"
).refine((value) => value.length <= 3_000_000, "Avatar image must be under 3 MB");

const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  avatarUrl: userAvatarSchema.nullable().optional(),
  province: z.string().length(2).optional(),
});

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIERS = [
  { name: "Beginner", min: 0,    max: 99   },
  { name: "Rookie",   min: 100,  max: 299  },
  { name: "Amateur",  min: 300,  max: 699  },
  { name: "Pro",      min: 700,  max: 1499 },
  { name: "Elite",    min: 1500, max: Infinity },
] as const;

function computeTier(points: number) {
  return TIERS.find((t) => points >= t.min && points <= t.max) ?? TIERS[0]!;
}

function computeStreak(sortedDates: string[]): number {
  if (!sortedDates.length) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const set = new Set(sortedDates);
  let streak = 0;
  const cursor = new Date(today);
  while (set.has(cursor.toISOString().split("T")[0]!)) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// GET /api/v1/users/me/profile
router.get("/me/profile", authenticate, async (req, res, next) => {
  try {
    const userId = req.user!.sub;

    const [user, confirmedBookings] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          phone: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          role: true,
          province: true,
          creditBalanceCAD: true,
          createdAt: true,
        },
      }),
      prisma.booking.findMany({
        where: { userId, status: BookingStatus.CONFIRMED },
        include: {
          slot: { select: { date: true, durationMinutes: true } },
          facility: { select: { sport: true } },
        },
      }),
    ]);

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const totalGames = confirmedBookings.length;
    const totalMinutes = confirmedBookings.reduce(
      (sum, b) => sum + b.slot!.durationMinutes,
      0
    );
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
    const totalPoints = Math.round(Number(user.creditBalanceCAD));

    const sportBreakdown: Record<string, number> = {};
    const bookingDates: string[] = [];
    for (const b of confirmedBookings) {
      const sport = b.facility.sport.toLowerCase();
      sportBreakdown[sport] = (sportBreakdown[sport] ?? 0) + 1;
      bookingDates.push(b.slot!.date.toISOString().split("T")[0]!);
    }

    const uniqueDates = [...new Set(bookingDates)].sort().reverse();
    const currentStreak = computeStreak(uniqueDates);
    const tier = computeTier(totalPoints);

    res.json({
      data: {
        user: { ...user, creditBalanceCAD: Number(user.creditBalanceCAD) },
        stats: {
          totalGames,
          totalHours,
          totalPoints,
          currentStreak,
          tier: tier.name.toUpperCase(),
          tierProgress: {
            min: tier.min,
            max: Number.isFinite(tier.max) ? tier.max : null,
          },
          sportBreakdown,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/users/me
router.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: {
        id: true, phone: true, firstName: true, lastName: true,
        avatarUrl: true, role: true, province: true,
      },
    });
    if (!user) { res.status(404).json({ message: "User not found" }); return; }
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
});

router.put("/me", authenticate, validate(updateUserSchema), async (req, res, next) => {
  try {
    const { province, ...rest } = req.body as z.infer<typeof updateUserSchema>;
    const user = await prisma.user.update({
      where: { id: req.user!.sub as string },
      data: {
        ...rest,
        ...(province !== undefined && { province: province as Province }),
      },
    });
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/users/me/credits — credit balance + transaction history
router.get("/me/credits", authenticate, async (req, res, next) => {
  try {
    const userId = req.user!.sub as string;
    const credits = await prisma.domeCredit.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    const now = new Date();
    const balance = credits
      .filter((c) => !c.expiresAt || c.expiresAt > now)
      .reduce((sum, c) => sum + Number(c.amountCAD), 0);
    res.json({
      balance: Math.round(balance * 100) / 100,
      credits: credits.map((c) => ({ ...c, amountCAD: Number(c.amountCAD) })),
    });
  } catch (err) { next(err); }
});

// POST /api/v1/users/me/device-token — register FCM token for push notifications
router.post("/me/device-token", authenticate, async (req, res, next) => {
  try {
    const { token } = req.body as { token?: unknown };
    if (!token || typeof token !== "string") {
      res.status(400).json({ message: "token is required" });
      return;
    }
    await prisma.user.update({
      where: { id: req.user!.sub as string },
      data: { deviceToken: token },
    });
    res.status(204).end();
  } catch (err) { next(err); }
});

// PUT /api/v1/users/me/email
const emailSchema = z.object({
  email: z.string().email().max(254),
});

router.put("/me/email", authenticate, validate(emailSchema), async (req, res, next) => {
  try {
    const { email } = req.body as z.infer<typeof emailSchema>;
    const user = await prisma.user.update({
      where: { id: req.user!.sub as string },
      data: { email: email.toLowerCase().trim() },
      select: { id: true, email: true },
    });
    res.json({ data: user });
  } catch (err) { next(err); }
});

// PUT /api/v1/users/me/email-preferences
const emailPrefsSchema = z.object({
  emailBookingConfirmation: z.boolean().optional(),
  emailReminders:           z.boolean().optional(),
  emailMarketing:           z.boolean().optional(),
});

router.put("/me/email-preferences", authenticate, validate(emailPrefsSchema), async (req, res, next) => {
  try {
    const data = req.body as z.infer<typeof emailPrefsSchema>;
    const user = await prisma.user.update({
      where: { id: req.user!.sub as string },
      data,
      select: { emailBookingConfirmation: true, emailReminders: true, emailMarketing: true },
    });
    res.json({ data: user });
  } catch (err) { next(err); }
});

// ─── PUT /api/v1/users/me/profile — first-time profile setup ─────────────────

const profileSetupSchema = z.object({
  firstName:       z.string().min(2, "First name must be at least 2 characters").max(50),
  lastName:        z.string().min(2, "Last name must be at least 2 characters").max(50),
  email:           z.string().email().max(254).optional().nullable(),
  dateOfBirth:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format").optional().nullable(),
  gender:          z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT"]).optional().nullable(),
  city:            z.string().min(1, "City is required").max(100),
  province:        z.string().length(2),
  preferredSports: z.array(z.string().min(1)).min(1, "Select at least one sport"),
});

router.put("/me/profile", authenticate, validate(profileSetupSchema), async (req, res, next) => {
  try {
    const userId = req.user!.sub as string;
    const body = req.body as z.infer<typeof profileSetupSchema>;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName:       body.firstName.trim(),
        lastName:        body.lastName.trim(),
        email:           body.email?.trim().toLowerCase() || null,
        dateOfBirth:     body.dateOfBirth ? new Date(body.dateOfBirth) : null,
        gender:          body.gender || null,
        city:            body.city.trim(),
        province:        body.province as Province,
        preferredSports: body.preferredSports,
        profileComplete: true,
      },
      select: {
        id: true, phone: true, firstName: true, lastName: true,
        avatarUrl: true, role: true, province: true,
        city: true, preferredSports: true, profileComplete: true,
      },
    });

    res.json({ data: user });
  } catch (err) { next(err); }
});

router.delete("/me", authenticate, async (req, res) => {
  // TODO: anonymize / delete account (PIPEDA compliance)
  res.status(204).end();
});

export default router;
