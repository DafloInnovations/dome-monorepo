import { Router } from "express";
import { z } from "zod";
import { BookingStatus, BookingPaymentStatus, BookingUnitType, OpenGameStatus, Prisma, SlotStatus } from "@prisma/client";
import { authenticate, requireRole } from "../middleware/auth";
import pricingRouter from "./pricing";
import QRCode from "qrcode";
import { stripe } from "../lib/stripe";
import { calculateSlotPrice } from "../services/pricing.service";
import { calculateTotal, getTaxRate } from "@dome/utils";
import { validate } from "../middleware/validate";
import { createFacility, updateFacility } from "../services/facilities.service";
import { sendVendorApplicationReceived } from "../lib/email";
import {
  getVendorEquipment,
  createEquipment,
  updateEquipment,
  deleteEquipment,
  getEquipmentRentalHistory,
} from "../services/equipment.service";
import { bulkCreateSlots, createCourt, updateCourtShared, upsertSportPricing, updateCourtDurationRules } from "../services/courts.service";
import { prisma } from "../lib/prisma";

const router = Router();

// ─── Pre-auth routes (authenticate only, no VENDOR role required) ─────────────

const applySchema = z.object({
  businessName:  z.string().min(2).max(100),
  businessEmail: z.string().email(),
  businessPhone: z.string().min(10).optional().or(z.literal("")),
  website:       z.string().url().optional().or(z.literal("")),
  streetAddress: z.string().min(3),
  city:          z.string().min(2),
  province:      z.string().length(2).default("ON"),
  postalCode:    z.string().min(6).max(7),
  sports:        z.array(z.string()).min(1, "Select at least one sport"),
  description:   z.string().min(20).max(2000),
  agreedToTerms: z.literal(true),
});

// POST /api/v1/vendor/apply — any authenticated user can apply
router.post("/apply", authenticate, validate(applySchema), async (req, res, next) => {
  try {
    const userId = req.user!.sub as string;
    const body = req.body as z.infer<typeof applySchema>;
    console.log("Vendor apply:", { userId, businessName: body.businessName, businessEmail: body.businessEmail, province: body.province, sports: body.sports });

    // Check if vendor record already exists
    const existing = await prisma.vendor.findUnique({ where: { userId } });
    if (existing && existing.status === "APPROVED") {
      res.status(409).json({ message: "Your account is already approved." });
      return;
    }
    if (existing && existing.status === "PENDING") {
      res.status(409).json({ message: "Application already submitted and under review." });
      return;
    }

    const provinceEnum = (body.province ?? "ON").toUpperCase() as "ON" | "BC" | "AB" | "QC" | "MB" | "SK" | "NS" | "NB" | "NL" | "PE" | "NT" | "NU" | "YT";

    if (existing) {
      // Re-application after rejection
      await prisma.vendor.update({
        where: { userId },
        data: {
          businessName: body.businessName,
          businessEmail: body.businessEmail,
          businessPhone: body.businessPhone || null,
          website: body.website || null,
          streetAddress: body.streetAddress,
          city: body.city,
          province: provinceEnum,
          postalCode: body.postalCode,
          sports: body.sports,
          description: body.description,
          status: "PENDING",
          rejectionReason: null,
          submittedAt: new Date(),
        },
      });
    } else {
      // New application
      await prisma.$transaction([
        prisma.vendor.create({
          data: {
            userId,
            businessName: body.businessName,
            businessEmail: body.businessEmail,
            businessPhone: body.businessPhone || null,
            website: body.website || null,
            streetAddress: body.streetAddress,
            city: body.city,
            province: provinceEnum,
            postalCode: body.postalCode,
            sports: body.sports,
            description: body.description,
            status: "PENDING",
            submittedAt: new Date(),
          },
        }),
        prisma.user.update({
          where: { id: userId },
          data: { role: "VENDOR" },
        }),
      ]);
      console.log("Vendor created for userId:", userId);
    }

    // Send confirmation email (non-blocking)
    const applicant = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true },
    });
    sendVendorApplicationReceived(applicant?.email, {
      vendorFirstName: applicant?.firstName || body.businessName,
      businessName: body.businessName,
      businessEmail: body.businessEmail,
      city: body.city,
      province: body.province,
      sports: body.sports,
    }).catch(() => null);

    res.status(201).json({ data: { status: "PENDING", message: "Application submitted successfully. We'll notify you within 24–48 hours." } });
  } catch (err) {
    console.error("Vendor apply error:", err);
    next(err);
  }
});

// GET /api/v1/vendor/application-status — any authenticated user
router.get("/application-status", authenticate, async (req, res, next) => {
  try {
    const userId = req.user!.sub as string;
    const vendor = await prisma.vendor.findUnique({
      where: { userId },
      select: { status: true, rejectionReason: true, submittedAt: true, approvedAt: true, businessName: true },
    });
    if (!vendor) {
      res.json({ data: { status: "NONE" } });
      return;
    }
    res.json({ data: vendor });
  } catch (err) { next(err); }
});

// ─── All routes below require VENDOR role ────────────────────────────────────
// POST /apply and GET /application-status are intentionally above this line.
// Adding routes here without reading this comment will expose them to all users.

router.use(authenticate, requireRole("VENDOR"));

// Pricing sub-router — inherits the VENDOR guard above
router.use("/courts", pricingRouter);

function param(p: string | string[]): string {
  return Array.isArray(p) ? p[0]! : p;
}

// ─── GET/PUT vendor profile ───────────────────────────────────────────────────

router.get("/profile", async (req, res, next) => {
  try {
    const vendor = await prisma.vendor.findUnique({
      where: { userId: req.user!.sub as string },
    });
    if (!vendor) { res.status(404).json({ message: "Vendor not found" }); return; }
    res.json({ data: vendor });
  } catch (err) { next(err); }
});

const updateProfileSchema = z.object({
  businessName:  z.string().min(2).max(100).optional(),
  businessEmail: z.string().email().optional().or(z.literal("")),
  businessPhone: z.string().min(10).optional().or(z.literal("")),
  website:       z.string().url().optional().or(z.literal("")),
  description:   z.string().max(2000).optional(),
});

router.put("/profile", validate(updateProfileSchema), async (req, res, next) => {
  try {
    const vendor = await prisma.vendor.findUnique({
      where: { userId: req.user!.sub as string },
    });
    if (!vendor) { res.status(404).json({ message: "Vendor not found" }); return; }

    const body = req.body as z.infer<typeof updateProfileSchema>;
    const updated = await prisma.vendor.update({
      where: { id: vendor.id },
      data: {
        ...(body.businessName  && { businessName:  body.businessName }),
        ...(body.businessEmail !== undefined && { businessEmail: body.businessEmail || null }),
        ...(body.businessPhone !== undefined && { businessPhone: body.businessPhone || null }),
        ...(body.website       !== undefined && { website:       body.website || null }),
        ...(body.description   !== undefined && { description:   body.description }),
      },
    });
    res.json({ data: updated });
  } catch (err) { next(err); }
});

// ─── GET vendor's facilities ──────────────────────────────────────────────────

router.get("/facilities", async (req, res, next) => {
  try {
    const vendor = await prisma.vendor.findUnique({
      where: { userId: req.user!.sub as string },
    });
    if (!vendor) { res.status(404).json({ message: "Vendor not found" }); return; }

    const facilities = await prisma.facility.findMany({
      where: { vendorId: vendor.id },
      include: {
        address: true,
        courts: { select: { id: true, name: true, isActive: true, dynamicPricingEnabled: true, sports: true, primarySport: true, isShared: true } },
        _count: { select: { bookings: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ data: facilities });
  } catch (err) { next(err); }
});

// ─── GET vendor's single facility ────────────────────────────────────────────

router.get("/facilities/:id", async (req, res, next) => {
  try {
    const vendor = await prisma.vendor.findUnique({
      where: { userId: req.user!.sub as string },
    });
    if (!vendor) { res.status(404).json({ message: "Vendor not found" }); return; }

    const facilityId = param(req.params["id"]!);
    const facility = await prisma.facility.findFirst({
      where: { id: facilityId, vendorId: vendor.id },
      include: {
        address: true,
        courts: { orderBy: { createdAt: "asc" } },
        operatingHours: { orderBy: { day: "asc" } },
      },
    });
    if (!facility) { res.status(404).json({ message: "Facility not found" }); return; }

    res.json({ data: facility });
  } catch (err) { next(err); }
});

// ─── GET vendor's bookings ────────────────────────────────────────────────────

router.get("/bookings", async (req, res, next) => {
  try {
    const vendor = await prisma.vendor.findUnique({
      where: { userId: req.user!.sub as string },
    });
    if (!vendor) { res.status(404).json({ message: "Vendor not found" }); return; }

    const facilityIds = (
      await prisma.facility.findMany({ where: { vendorId: vendor.id }, select: { id: true } })
    ).map((f) => f.id);

    const { status, from, to, page = "1", limit = "50" } = req.query as Record<string, string>;
    const take = Math.min(Number(limit), 100);
    const skip = (Math.max(Number(page), 1) - 1) * take;

    const where: Prisma.BookingWhereInput = {
      facilityId: { in: facilityIds },
      ...(status && { status: status as BookingStatus }),
      ...(from && { slot: { date: { gte: new Date(from) } } }),
    };

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          slot: { include: { court: { select: { name: true } } } },
          facility: { select: { name: true, sport: true } },
          user: { select: { id: true, firstName: true, lastName: true, phone: true } },
          payment: { select: { status: true, amountCAD: true, method: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.booking.count({ where }),
    ]);

    res.json({
      data: bookings.map((b) => ({
        ...b,
        totalCAD: Number(b.totalCAD),
        subtotalCAD: Number(b.subtotalCAD),
        taxCAD: Number(b.taxCAD),
      })),
      total,
      page: Number(page),
      limit: take,
    });
  } catch (err) { next(err); }
});

// ─── GET dashboard (date-filtered stats + bookings) ──────────────────────────

router.get("/dashboard", async (req, res, next) => {
  try {
    const vendor = await prisma.vendor.findUnique({
      where: { userId: req.user!.sub as string },
    });
    if (!vendor) { res.status(404).json({ message: "Vendor not found" }); return; }

    const facilityIds = (
      await prisma.facility.findMany({ where: { vendorId: vendor.id }, select: { id: true } })
    ).map((f) => f.id);

    const { startDate, endDate } = req.query as Record<string, string | undefined>;

    // Default: current month
    const now = new Date();
    const start = startDate
      ? new Date(startDate + "T00:00:00.000Z")
      : new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    const end = endDate
      ? new Date(endDate + "T23:59:59.999Z")
      : new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));

    const [bookings, activeCourts, totalSlots, bookedSlots] = await Promise.all([
      prisma.booking.findMany({
        where: {
          facilityId: { in: facilityIds },
          createdAt: { gte: start, lte: end },
        },
        include: {
          slot: { include: { court: { select: { name: true, id: true } } } },
          facility: { select: { name: true, sport: true } },
          user: { select: { id: true, firstName: true, lastName: true, phone: true } },
          payment: { select: { status: true, amountCAD: true, method: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.court.count({ where: { facility: { vendorId: vendor.id }, isActive: true } }),
      prisma.slot.count({ where: { facilityId: { in: facilityIds }, date: { gte: start, lte: end } } }),
      prisma.slot.count({ where: { facilityId: { in: facilityIds }, date: { gte: start, lte: end }, status: "BOOKED" } }),
    ]);

    const confirmed = bookings.filter((b) => b.status === BookingStatus.CONFIRMED);
    const cancelled = bookings.filter((b) => b.status === BookingStatus.CANCELLED);
    const pending   = bookings.filter((b) => b.status === BookingStatus.PENDING);

    const revenue = confirmed.reduce((sum, b) => sum + Number(b.totalCAD), 0);

    const revenueByDay: Record<string, number> = {};
    for (const b of confirmed) {
      const day = b.createdAt.toISOString().split("T")[0]!;
      revenueByDay[day] = (revenueByDay[day] ?? 0) + Number(b.totalCAD);
    }

    const revenueByCourt: Record<string, number> = {};
    for (const b of confirmed) {
      const courtName = b.slot?.court?.name ?? "Unknown";
      revenueByCourt[courtName] = (revenueByCourt[courtName] ?? 0) + Number(b.totalCAD);
    }

    res.json({
      data: {
        stats: {
          totalBookings:     bookings.length,
          confirmedBookings: confirmed.length,
          cancelledBookings: cancelled.length,
          pendingBookings:   pending.length,
          revenue:           Math.round(revenue * 100) / 100,
          activeCourts,
          occupancyRate: totalSlots > 0 ? Math.round((bookedSlots / totalSlots) * 100) : 0,
        },
        revenueByDay,
        revenueByCourt,
        bookings: bookings.map((b) => ({
          ...b,
          totalCAD:    Number(b.totalCAD),
          subtotalCAD: Number(b.subtotalCAD),
          taxCAD:      Number(b.taxCAD),
        })),
        dateRange: {
          startDate: start.toISOString().split("T")[0]!,
          endDate:   end.toISOString().split("T")[0]!,
        },
      },
    });
  } catch (err) { next(err); }
});

// ─── GET analytics ────────────────────────────────────────────────────────────

router.get("/analytics", async (req, res, next) => {
  try {
    const vendor = await prisma.vendor.findUnique({
      where: { userId: req.user!.sub as string },
    });
    if (!vendor) { res.status(404).json({ message: "Vendor not found" }); return; }

    const facilityIds = (
      await prisma.facility.findMany({ where: { vendorId: vendor.id }, select: { id: true } })
    ).map((f) => f.id);

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3_600_000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [confirmedBookings, allRecent, cancelledRecent, courts] = await Promise.all([
      prisma.booking.findMany({
        where: {
          facilityId: { in: facilityIds },
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
          createdAt: { gte: thirtyDaysAgo },
        },
        include: {
          facility: { select: { sport: true } },
          slot: { select: { startTime: true } },
        },
      }),
      prisma.booking.count({
        where: { facilityId: { in: facilityIds }, createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.booking.count({
        where: { facilityId: { in: facilityIds }, status: BookingStatus.CANCELLED, createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.court.findMany({
        where: { facility: { vendorId: vendor.id } },
        include: {
          slots: {
            where: { date: { gte: thirtyDaysAgo } },
            select: { status: true },
          },
        },
      }),
    ]);

    // Revenue by day (last 30 days)
    const revenueMap: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(thirtyDaysAgo.getTime() + i * 24 * 3_600_000);
      revenueMap[d.toISOString().split("T")[0]!] = 0;
    }
    for (const b of confirmedBookings) {
      const day = b.createdAt.toISOString().split("T")[0]!;
      if (day in revenueMap) revenueMap[day]! += Number(b.totalCAD);
    }
    const revenueByDay = Object.entries(revenueMap).map(([date, amount]) => ({ date, amount }));

    // Month totals
    const monthBookings = confirmedBookings.filter((b) => b.createdAt >= startOfMonth);
    const totalRevenueMonth = monthBookings.reduce((s, b) => s + Number(b.totalCAD), 0);

    // Today bookings
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayBookings = await prisma.booking.count({
      where: {
        facilityId: { in: facilityIds },
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] },
        slot: { date: { gte: todayStart } },
      },
    });

    // Top sports
    const sportCounts: Record<string, number> = {};
    for (const b of confirmedBookings) {
      const sport = b.facility.sport as string;
      sportCounts[sport] = (sportCounts[sport] ?? 0) + 1;
    }
    const topSports = Object.entries(sportCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([sport, count]) => ({ sport, count }));

    // Occupancy by court
    const occupancyRateByCourt = courts.map((c) => ({
      courtId: c.id,
      courtName: c.name,
      totalSlots: c.slots.length,
      bookedSlots: c.slots.filter((s) => s.status === SlotStatus.BOOKED).length,
      occupancyRate:
        c.slots.length > 0
          ? Math.round((c.slots.filter((s) => s.status === SlotStatus.BOOKED).length / c.slots.length) * 100)
          : 0,
    }));

    // Peak hours (0–23) from slot start times
    const hourCounts: Record<number, number> = {};
    for (let h = 0; h < 24; h++) hourCounts[h] = 0;
    for (const b of confirmedBookings) {
      if (b.slot?.startTime) {
        const hour = parseInt(b.slot.startTime.split(":")[0]!, 10);
        if (!isNaN(hour)) hourCounts[hour]! += 1;
      }
    }
    const peakHours = Object.entries(hourCounts).map(([hour, count]) => ({ hour: Number(hour), count }));

    // Booking count by day (last 30 days)
    const bookingCountMap: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(thirtyDaysAgo.getTime() + i * 24 * 3_600_000);
      bookingCountMap[d.toISOString().split("T")[0]!] = 0;
    }
    for (const b of confirmedBookings) {
      const day = b.createdAt.toISOString().split("T")[0]!;
      if (day in bookingCountMap) bookingCountMap[day]! += 1;
    }
    const bookingsByDay = Object.entries(bookingCountMap).map(([date, count]) => ({ date, count }));

    // Avg booking value
    const avgBookingValue = monthBookings.length > 0
      ? Math.round((totalRevenueMonth / monthBookings.length) * 100) / 100
      : 0;

    // Overall occupancy rate across all courts
    const totalSlots = occupancyRateByCourt.reduce((s, c) => s + c.totalSlots, 0);
    const totalBooked = occupancyRateByCourt.reduce((s, c) => s + c.bookedSlots, 0);
    const overallOccupancyRate = totalSlots > 0 ? Math.round((totalBooked / totalSlots) * 100) : 0;

    res.json({
      data: {
        revenueByDay,
        bookingsByDay,
        totalRevenueMonth: Math.round(totalRevenueMonth * 100) / 100,
        totalBookingsMonth: monthBookings.length,
        avgBookingValue,
        todayBookings,
        occupancyRateByCourt,
        overallOccupancyRate,
        topSports,
        peakHours,
        cancellationRate: allRecent > 0 ? Math.round((cancelledRecent / allRecent) * 100) : 0,
      },
    });
  } catch (err) { next(err); }
});

// ─── GET slots for a court ────────────────────────────────────────────────────

router.get("/courts/:id/slots", async (req, res, next) => {
  try {
    const courtId = param(req.params["id"]!);
    const { from, to } = req.query as { from?: string; to?: string };

    const now = new Date();
    const startDate = from ? new Date(from) : now;
    const endDate = to
      ? new Date(to)
      : new Date(now.getTime() + 30 * 24 * 3_600_000);

    const slots = await prisma.slot.findMany({
      where: { courtId, date: { gte: startDate, lte: endDate } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    res.json({ data: slots.map((s) => ({ ...s, priceCAD: Number(s.priceCAD) })) });
  } catch (err) { next(err); }
});

// ─── Facility schemas ─────────────────────────────────────────────────────────

const addressSchema = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  province: z.string().length(2),
  postalCode: z.string().min(6).max(7),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
});

const operatingHoursSchema = z
  .array(
    z.object({
      day: z.number().int().min(0).max(6),
      openTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:mm"),
      closeTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:mm"),
      isClosed: z.boolean().optional().default(false),
    })
  )
  .optional();

const facilityImageSchema = z.string().refine(
  (value) =>
    /^https?:\/\//i.test(value) ||
    /^data:image\/(png|jpe?g|webp);base64,/i.test(value),
  "Image must be a URL or uploaded image"
);

const createFacilitySchema = z.object({
  description: z.string().min(10).max(2000),
  sport: z.enum([
    "soccer", "basketball", "tennis", "badminton", "volleyball",
    "hockey", "squash", "pickleball", "baseball", "cricket",
  ]),
  surface: z.enum(["turf", "hardwood", "concrete", "clay", "ice", "grass", "rubberized"]),
  capacity: z.number().int().positive(),
  images: z.array(facilityImageSchema).max(5).optional().default([]),
  address: addressSchema,
  operatingHours: operatingHoursSchema,
});

const updateFacilitySchema = createFacilitySchema.partial().extend({
  isActive: z.boolean().optional(),
  address: addressSchema.partial().optional(),
  cancellationWindowHours: z.number().int().refine((v) => [12, 24, 48].includes(v)).optional(),
});

// ─── Court schemas ────────────────────────────────────────────────────────────

const sportEnum = z.enum([
  "SOCCER", "BASKETBALL", "TENNIS", "BADMINTON", "VOLLEYBALL",
  "HOCKEY", "SQUASH", "PICKLEBALL", "BASEBALL", "CRICKET",
]);

const createCourtSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  unitType: z.nativeEnum(BookingUnitType).optional(),
  unitLabel: z.string().min(1).max(40).optional(),
  maxPlayers: z.number().int().positive().optional(),
  isShared: z.boolean().optional(),
  sports: z.array(sportEnum).max(10).optional(),
  primarySport: sportEnum.optional(),
});

const bulkSlotsSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  weekdays: z.array(z.number().int().min(0).max(6)).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "HH:mm"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "HH:mm"),
  slotDurationMinutes: z.number().int().positive(),
  priceCAD: z.number().positive(),
  sport: sportEnum.optional(),
  conflictStrategy: z.enum(["skip", "replace"]).optional().default("skip"),
});

const sharedCourtSchema = z.object({
  isShared: z.boolean(),
  sports: z.array(sportEnum).max(10).optional(),
  primarySport: sportEnum.optional(),
  sportPricing: z.array(z.object({
    sport: sportEnum,
    priceCAD: z.number().positive(),
  })).optional(),
});

const sportPricingSchema = z.object({
  sportPricing: z.array(z.object({
    sport: sportEnum,
    priceCAD: z.number().positive(),
  })).min(1),
});

// ─── Facility routes ──────────────────────────────────────────────────────────

// POST /api/v1/vendor/facilities
router.post("/facilities", validate(createFacilitySchema), async (req, res, next) => {
  try {
    res.status(201).json({ data: await createFacility(req.user!.sub, req.body) });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/vendor/facilities/:id
router.put("/facilities/:id", validate(updateFacilitySchema), async (req, res, next) => {
  try {
    const id = Array.isArray(req.params["id"]) ? req.params["id"][0]! : req.params["id"]!;
    res.json({ data: await updateFacility(req.user!.sub, id, req.body) });
  } catch (err) {
    next(err);
  }
});

// ─── Court routes ─────────────────────────────────────────────────────────────

// POST /api/v1/vendor/facilities/:id/courts
router.post("/facilities/:id/courts", validate(createCourtSchema), async (req, res, next) => {
  try {
    const facilityId = Array.isArray(req.params["id"])
      ? req.params["id"][0]!
      : req.params["id"]!;
    const court = await createCourt(req.user!.sub, facilityId, req.body);
    res.status(201).json({ data: court });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/vendor/courts/:id — fetch single court with all settings
router.get("/courts/:id", async (req, res, next) => {
  try {
    const courtId = param(req.params["id"]!);
    const vendor = await prisma.vendor.findUnique({
      where: { userId: req.user!.sub as string },
      select: { id: true },
    });
    if (!vendor) { res.status(404).json({ message: "Vendor not found" }); return; }

    const court = await prisma.court.findFirst({
      where: { id: courtId, facility: { vendorId: vendor.id } },
      include: { facility: { select: { id: true, name: true } } },
    });
    if (!court) { res.status(404).json({ message: "Court not found" }); return; }
    res.json({ data: court });
  } catch (err) { next(err); }
});

const durationRulesSchema = z.object({
  minBookingMinutes:   z.number().int().refine((v) => [30, 60].includes(v), "Must be 30 or 60"),
  durationStepMinutes: z.number().int().refine((v) => [30, 60].includes(v), "Must be 30 or 60"),
  maxBookingMinutes:   z.number().int().refine((v) => [60, 120, 180, 240].includes(v), "Must be 60, 120, 180, or 240"),
});

// PUT /api/v1/vendor/courts/:id/duration-rules
router.put("/courts/:id/duration-rules", validate(durationRulesSchema), async (req, res, next) => {
  try {
    const courtId = param(req.params["id"]!);
    const rules = req.body as z.infer<typeof durationRulesSchema>;
    if (rules.minBookingMinutes > rules.maxBookingMinutes) {
      res.status(422).json({ message: "Minimum must not exceed maximum" }); return;
    }
    const data = await updateCourtDurationRules(req.user!.sub as string, courtId, rules);
    res.json({ data });
  } catch (err) { next(err); }
});

// PUT /api/v1/vendor/courts/:id/shared — configure shared court sports & pricing
router.put("/courts/:id/shared", validate(sharedCourtSchema), async (req, res, next) => {
  try {
    const courtId = param(req.params["id"]!);
    const body = req.body as z.infer<typeof sharedCourtSchema>;
    const data = await updateCourtShared(req.user!.sub as string, courtId, body);
    res.json({ data });
  } catch (err) { next(err); }
});

// PUT /api/v1/vendor/courts/:id/sport-pricing — set per-sport pricing
router.put("/courts/:id/sport-pricing", validate(sportPricingSchema), async (req, res, next) => {
  try {
    const courtId = param(req.params["id"]!);
    const { sportPricing } = req.body as z.infer<typeof sportPricingSchema>;
    const data = await upsertSportPricing(req.user!.sub as string, courtId, sportPricing);
    res.json({ data });
  } catch (err) { next(err); }
});

// POST /api/v1/vendor/courts/:id/slots/bulk
router.post("/courts/:id/slots/bulk", validate(bulkSlotsSchema), async (req, res, next) => {
  try {
    const courtId = Array.isArray(req.params["id"]) ? req.params["id"][0]! : req.params["id"]!;
    const { conflictStrategy, ...slotInput } = req.body as z.infer<typeof bulkSlotsSchema>;

    // Ownership check before we touch anything
    const court = await prisma.court.findFirst({
      where: { id: courtId, facility: { vendor: { userId: req.user!.sub as string } } },
      select: { id: true },
    });
    if (!court) { res.status(404).json({ message: "Court not found" }); return; }

    // Count existing slots in range so we can report conflicts
    const existed = await prisma.slot.count({
      where: { courtId, date: { gte: new Date(slotInput.startDate), lte: new Date(slotInput.endDate) } },
    });

    if (conflictStrategy === "replace" && existed > 0) {
      await prisma.slot.deleteMany({
        where: {
          courtId,
          status: { not: SlotStatus.BOOKED },
          date: { gte: new Date(slotInput.startDate), lte: new Date(slotInput.endDate) },
        },
      });
    }

    const result = await bulkCreateSlots(req.user!.sub, courtId, slotInput);
    res.status(201).json({ data: { ...result, existed: conflictStrategy === "replace" ? 0 : existed } });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/vendor/courts/:id/slots/preview — count slots without creating
const previewSlotsSchema = z.object({
  startDate:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate:             z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime:           z.string().regex(/^\d{2}:\d{2}$/),
  endTime:             z.string().regex(/^\d{2}:\d{2}$/),
  slotDurationMinutes: z.number().int().positive(),
  priceCAD:            z.number().positive(),
  daysOfWeek:          z.array(z.number().int().min(0).max(6)).optional(),
});

router.post("/courts/:id/slots/preview", validate(previewSlotsSchema), async (req, res, next) => {
  try {
    const { startDate, endDate, startTime, endTime, slotDurationMinutes, priceCAD, daysOfWeek } =
      req.body as z.infer<typeof previewSlotsSchema>;

    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const windowMins = (eh! * 60 + em!) - (sh! * 60 + sm!);
    if (windowMins <= 0) { res.status(400).json({ message: "endTime must be after startTime" }); return; }

    const slotsPerDay = Math.floor(windowMins / slotDurationMinutes);
    let totalDays = 0;
    const cur = new Date(startDate + "T00:00:00Z");
    const end = new Date(endDate + "T00:00:00Z");
    while (cur <= end) {
      if (!daysOfWeek || daysOfWeek.includes(cur.getUTCDay())) totalDays++;
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    res.json({
      data: {
        totalDays,
        slotsPerDay,
        totalSlots: totalDays * slotsPerDay,
        potentialRevenueCAD: Math.round(totalDays * slotsPerDay * priceCAD * 100) / 100,
      },
    });
  } catch (err) { next(err); }
});

// POST /api/v1/vendor/courts/:id/slots/bulk-schedule — weekday + weekend slots in one call
const bulkScheduleSchema = z.object({
  startDate:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate:             z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slotDurationMinutes: z.number().int().positive(),
  sport:   sportEnum.optional(),
  weekday: z.object({
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime:   z.string().regex(/^\d{2}:\d{2}$/),
    priceCAD:  z.number().positive(),
  }),
  weekend: z.object({
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime:   z.string().regex(/^\d{2}:\d{2}$/),
    priceCAD:  z.number().positive(),
  }),
});

router.post("/courts/:id/slots/bulk-schedule", validate(bulkScheduleSchema), async (req, res, next) => {
  try {
    const courtId = param(req.params["id"]!);
    const { startDate, endDate, slotDurationMinutes, sport, weekday, weekend } =
      req.body as z.infer<typeof bulkScheduleSchema>;
    const userId = req.user!.sub as string;

    const court = await prisma.court.findFirst({
      where: { id: courtId, facility: { vendor: { userId } } },
      select: { id: true },
    });
    if (!court) { res.status(404).json({ message: "Court not found" }); return; }

    const [wdResult, weResult] = await Promise.all([
      bulkCreateSlots(userId, courtId, {
        startDate, endDate, weekdays: [1, 2, 3, 4, 5],
        startTime: weekday.startTime, endTime: weekday.endTime,
        slotDurationMinutes, priceCAD: weekday.priceCAD, sport,
      }),
      bulkCreateSlots(userId, courtId, {
        startDate, endDate, weekdays: [0, 6],
        startTime: weekend.startTime, endTime: weekend.endTime,
        slotDurationMinutes, priceCAD: weekend.priceCAD, sport,
      }),
    ]);

    res.status(201).json({
      data: {
        weekdaySlots: { created: wdResult.created, skipped: wdResult.skipped },
        weekendSlots: { created: weResult.created, skipped: weResult.skipped },
        total: { created: wdResult.created + weResult.created, skipped: wdResult.skipped + weResult.skipped },
      },
    });
  } catch (err) { next(err); }
});

// ─── Cancel booking ───────────────────────────────────────────────────────────

// PUT /api/v1/vendor/bookings/:id/cancel
router.put("/bookings/:id/cancel", async (req, res, next) => {
  try {
    const bookingId = param(req.params["id"]!);
    const vendor = await prisma.vendor.findUnique({
      where: { userId: req.user!.sub as string },
    });
    if (!vendor) { res.status(404).json({ message: "Vendor not found" }); return; }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { facility: { select: { vendorId: true } } },
    });
    if (!booking) { res.status(404).json({ message: "Booking not found" }); return; }
    if (booking.facility.vendorId !== vendor.id) {
      res.status(403).json({ message: "Not your booking" }); return;
    }
    if (booking.status === BookingStatus.CANCELLED) {
      res.status(400).json({ message: "Already cancelled" }); return;
    }

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CANCELLED },
    });
    await prisma.slot.update({
      where: { id: booking.slotId! },
      data: { status: SlotStatus.AVAILABLE },
    });

    res.json({ data: { ...updated, totalCAD: Number(updated.totalCAD) } });
  } catch (err) { next(err); }
});

// ─── Bulk block slots ─────────────────────────────────────────────────────────

const blockSlotsSchema = z.object({
  courtId: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(200).optional(),
});

// POST /api/v1/vendor/slots/block
router.post("/slots/block", validate(blockSlotsSchema), async (req, res, next) => {
  try {
    const { courtId, startDate, endDate } = req.body as z.infer<typeof blockSlotsSchema>;
    const vendor = await prisma.vendor.findUnique({
      where: { userId: req.user!.sub as string },
    });
    if (!vendor) { res.status(404).json({ message: "Vendor not found" }); return; }

    const court = await prisma.court.findUnique({
      where: { id: courtId },
      include: { facility: { select: { vendorId: true } } },
    });
    if (!court || court.facility.vendorId !== vendor.id) {
      res.status(403).json({ message: "Not your court" }); return;
    }

    const result = await prisma.slot.updateMany({
      where: {
        courtId,
        status: SlotStatus.AVAILABLE,
        date: { gte: new Date(startDate), lte: new Date(endDate) },
      },
      data: { status: SlotStatus.BLOCKED },
    });

    res.json({ data: { blocked: result.count } });
  } catch (err) { next(err); }
});

// ─── Individual slot management ──────────────────────────────────────────────

async function resolveVendorSlot(userId: string, slotId: string) {
  const vendor = await prisma.vendor.findUnique({ where: { userId }, select: { id: true } });
  if (!vendor) return null;
  const slot = await prisma.slot.findUnique({
    where: { id: slotId },
    include: { court: { include: { facility: { select: { vendorId: true } } } } },
  });
  if (!slot || !slot.court || slot.court.facility.vendorId !== vendor.id) return null;
  return slot;
}

// DELETE /api/v1/vendor/slots/bulk — must be registered before /:slotId
const bulkDeleteSlotsSchema = z.object({
  slotIds: z.array(z.string().min(1)).min(1).max(500),
});

router.delete("/slots/bulk", validate(bulkDeleteSlotsSchema), async (req, res, next) => {
  try {
    const { slotIds } = req.body as z.infer<typeof bulkDeleteSlotsSchema>;
    const vendor = await prisma.vendor.findUnique({ where: { userId: req.user!.sub as string }, select: { id: true } });
    if (!vendor) { res.status(404).json({ message: "Vendor not found" }); return; }

    const slots = await prisma.slot.findMany({
      where: { id: { in: slotIds } },
      include: { court: { include: { facility: { select: { vendorId: true } } } } },
    });

    const deletableIds = slots
      .filter((s) => s.court && s.court.facility.vendorId === vendor.id && s.status !== SlotStatus.BOOKED)
      .map((s) => s.id);

    const result = await prisma.slot.deleteMany({ where: { id: { in: deletableIds } } });
    res.json({ data: { deleted: result.count, skipped: slotIds.length - result.count } });
  } catch (err) { next(err); }
});

// DELETE /api/v1/vendor/slots/:slotId
router.delete("/slots/:slotId", async (req, res, next) => {
  try {
    const slot = await resolveVendorSlot(req.user!.sub as string, param(req.params["slotId"]!));
    if (!slot) { res.status(404).json({ message: "Slot not found" }); return; }
    if (slot.status === SlotStatus.BOOKED) { res.status(400).json({ message: "Cannot delete a booked slot" }); return; }
    await prisma.slot.delete({ where: { id: slot.id } });
    res.status(204).end();
  } catch (err) { next(err); }
});

// PUT /api/v1/vendor/slots/:slotId/block
router.put("/slots/:slotId/block", async (req, res, next) => {
  try {
    const slot = await resolveVendorSlot(req.user!.sub as string, param(req.params["slotId"]!));
    if (!slot) { res.status(404).json({ message: "Slot not found" }); return; }
    if (slot.status === SlotStatus.BOOKED) { res.status(400).json({ message: "Cannot block a booked slot" }); return; }
    const updated = await prisma.slot.update({ where: { id: slot.id }, data: { status: SlotStatus.BLOCKED } });
    res.json({ data: { ...updated, priceCAD: Number(updated.priceCAD) } });
  } catch (err) { next(err); }
});

// PUT /api/v1/vendor/slots/:slotId/unblock
router.put("/slots/:slotId/unblock", async (req, res, next) => {
  try {
    const slot = await resolveVendorSlot(req.user!.sub as string, param(req.params["slotId"]!));
    if (!slot) { res.status(404).json({ message: "Slot not found" }); return; }
    const updated = await prisma.slot.update({ where: { id: slot.id }, data: { status: SlotStatus.AVAILABLE } });
    res.json({ data: { ...updated, priceCAD: Number(updated.priceCAD) } });
  } catch (err) { next(err); }
});

// PUT /api/v1/vendor/slots/:slotId — update price or status
const updateSlotSchema = z.object({
  priceCAD: z.number().positive().optional(),
  status: z.nativeEnum(SlotStatus).optional(),
});

router.put("/slots/:slotId", validate(updateSlotSchema), async (req, res, next) => {
  try {
    const slot = await resolveVendorSlot(req.user!.sub as string, param(req.params["slotId"]!));
    if (!slot) { res.status(404).json({ message: "Slot not found" }); return; }
    if (slot.status === SlotStatus.BOOKED) { res.status(400).json({ message: "Cannot modify a booked slot" }); return; }

    const body = req.body as z.infer<typeof updateSlotSchema>;
    const updated = await prisma.slot.update({
      where: { id: slot.id },
      data: {
        ...(body.priceCAD !== undefined && { priceCAD: body.priceCAD }),
        ...(body.status   !== undefined && { status:   body.status }),
      },
    });
    res.json({ data: { ...updated, priceCAD: Number(updated.priceCAD) } });
  } catch (err) { next(err); }
});

// ─── Vendor open games ────────────────────────────────────────────────────────

// GET /api/v1/vendor/connect/games
router.get("/connect/games", async (req, res, next) => {
  try {
    const vendor = await prisma.vendor.findUnique({
      where: { userId: req.user!.sub as string },
    });
    if (!vendor) { res.status(404).json({ message: "Vendor not found" }); return; }

    const facilityIds = (
      await prisma.facility.findMany({ where: { vendorId: vendor.id }, select: { id: true } })
    ).map((f) => f.id);
    const facilityIdSet = new Set(facilityIds);

    const games = await prisma.openGame.findMany({
      where: {
        status: OpenGameStatus.OPEN,
        isPublic: true,
      },
      include: {
        host: { select: { id: true, firstName: true, lastName: true } },
        facility: { select: { id: true, name: true, address: true } },
        _count: { select: { participants: true } },
      },
      orderBy: { gameDate: "asc" },
    });

    res.json({
      data: games.map((game) => ({
        ...game,
        gameDate: game.gameDate?.toISOString().split("T")[0] ?? null,
        isOwnFacility: facilityIdSet.has(game.facilityId),
      })),
    });
  } catch (err) { next(err); }
});

// ─── GET /api/v1/vendor/recurring ────────────────────────────────────────────

router.get("/recurring", async (req, res, next) => {
  try {
    const vendor = await prisma.vendor.findUnique({
      where: { userId: req.user!.sub as string },
      select: { id: true },
    });
    if (!vendor) { res.status(404).json({ message: "Vendor not found" }); return; }

    const facilityIds = (await prisma.facility.findMany({ where: { vendorId: vendor.id }, select: { id: true } })).map((f) => f.id);

    const series = await prisma.recurringSeries.findMany({
      where: { facilityId: { in: facilityIds } },
      include: {
        user:     { select: { id: true, firstName: true, lastName: true, phone: true } },
        facility: { select: { id: true, name: true } },
        court:    { select: { id: true, name: true } },
        bookings: { select: { id: true, status: true, totalCAD: true, recurringSeriesIndex: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const activeSeries = series.filter((s) => s.status === "ACTIVE");
    const weeklyRevenue = activeSeries.reduce((sum, s) => {
      const weekly = (s.frequency === "WEEKLY" ? 1 : s.frequency === "BIWEEKLY" ? 0.5 : 0.25);
      return sum + Number(s.pricePerSessionCAD) * weekly * s.daysOfWeek.length;
    }, 0);

    const completedCount = series.filter((s) => s.status === "COMPLETED").length;
    const renewedCount = Math.floor(completedCount * 0.6); // placeholder for retention

    res.json({
      data: {
        summary: {
          totalActive: activeSeries.length,
          weeklyRecurringRevenueCAD: Math.round(weeklyRevenue * 100) / 100,
          retentionRate: completedCount > 0 ? Math.round((renewedCount / completedCount) * 100) : null,
        },
        series: series.map((s) => ({
          ...s,
          pricePerSessionCAD: Number(s.pricePerSessionCAD),
          weeklyValueCAD: Math.round(Number(s.pricePerSessionCAD) * s.daysOfWeek.length * (s.frequency === "WEEKLY" ? 1 : s.frequency === "BIWEEKLY" ? 0.5 : 0.25) * 100) / 100,
          totalSeriesValueCAD: Math.round(Number(s.pricePerSessionCAD) * s.totalOccurrences * 100) / 100,
          bookings: s.bookings.map((b) => ({ ...b, totalCAD: Number(b.totalCAD) })),
        })),
      },
    });
  } catch (err) { next(err); }
});

// ─── Equipment ────────────────────────────────────────────────────────────────

const equipmentSchema = z.object({
  name:        z.string().min(1).max(100),
  description: z.string().max(300).optional().nullable(),
  sport:       z.string().min(2).max(30),
  priceCAD:    z.number().positive().max(200),
  quantity:    z.number().int().min(1).max(1000),
  imageUrl:    z.string().url().optional().nullable(),
});

const equipmentUpdateSchema = equipmentSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// GET /api/v1/vendor/equipment
router.get("/equipment", async (req, res, next) => {
  try {
    const data = await getVendorEquipment(req.user!.sub as string);
    res.json({ data });
  } catch (err) { next(err); }
});

// POST /api/v1/vendor/facilities/:id/equipment
router.post("/facilities/:id/equipment", validate(equipmentSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof equipmentSchema>;
    const equipmentData = {
      ...body,
      description: body.description ?? undefined,
      imageUrl: body.imageUrl ?? undefined,
    };
    const data = await createEquipment(
      req.user!.sub as string,
      param(req.params["id"]!),
      equipmentData
    );
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

// PUT /api/v1/vendor/equipment/:id
router.put("/equipment/:id", validate(equipmentUpdateSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof equipmentUpdateSchema>;
    const equipmentData = {
      ...body,
      description: body.description ?? undefined,
      imageUrl: body.imageUrl ?? undefined,
    };
    const data = await updateEquipment(
      req.user!.sub as string,
      param(req.params["id"]!),
      equipmentData
    );
    res.json({ data });
  } catch (err) { next(err); }
});

// DELETE /api/v1/vendor/equipment/:id
router.delete("/equipment/:id", async (req, res, next) => {
  try {
    await deleteEquipment(req.user!.sub as string, param(req.params["id"]!));
    res.status(204).end();
  } catch (err) { next(err); }
});

// GET /api/v1/vendor/equipment/:id/rentals
router.get("/equipment/:id/rentals", async (req, res, next) => {
  try {
    const data = await getEquipmentRentalHistory(req.user!.sub as string, param(req.params["id"]!));
    res.json({ data });
  } catch (err) { next(err); }
});

// ─── Walk-in POS ──────────────────────────────────────────────────────────────

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h! * 60 + m! + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

async function getBaseHourlyRate(courtId: string, sport: string): Promise<number> {
  const sportPricing = await prisma.courtSportPricing.findUnique({
    where: { courtId_sport: { courtId, sport: sport.toUpperCase() } },
  });
  if (sportPricing) return Number(sportPricing.priceCAD);

  const refSlot = await prisma.slot.findFirst({
    where: { courtId, status: "AVAILABLE" },
    select: { priceCAD: true, durationMinutes: true },
  });
  if (refSlot && refSlot.durationMinutes > 0) {
    return (Number(refSlot.priceCAD) / refSlot.durationMinutes) * 60;
  }
  return 25;
}

const walkinSchema = z.object({
  courtId:         z.string().min(1),
  facilityId:      z.string().min(1),
  date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime:       z.string().regex(/^\d{2}:\d{2}$/),
  durationMinutes: z.coerce.number().int().min(30).max(240),
  sport:           z.string().min(1),
  playerName:      z.string().optional(),
  playerPhone:     z.string().optional(),
});

// GET /api/v1/vendor/walkin/price — pricing preview (call before POST /walkin)
router.get("/walkin/price", async (req, res, next) => {
  try {
    const { courtId, date, startTime, durationMinutes, sport } = req.query as Record<string, string>;
    if (!courtId || !date || !startTime || !durationMinutes || !sport) {
      res.status(400).json({ message: "Missing required query params" });
      return;
    }

    const vendor = await prisma.vendor.findUnique({
      where: { userId: req.user!.sub as string },
      select: { id: true, province: true },
    });
    if (!vendor) { res.status(404).json({ message: "Vendor not found" }); return; }

    const mins = Number(durationMinutes);
    const endTime = addMinutesToTime(startTime, mins);
    const dateObj = new Date(date);

    const basePricePerHour = await getBaseHourlyRate(courtId, sport);
    const basePriceCAD = (basePricePerHour / 60) * mins;
    const pricing = await calculateSlotPrice(courtId, dateObj, startTime, endTime, basePriceCAD);
    const { subtotalCAD, taxCAD, totalCAD } = calculateTotal(pricing.finalPriceCAD, vendor.province);

    res.json({
      data: {
        basePriceCAD: Math.round(basePriceCAD * 100) / 100,
        subtotalCAD,
        taxCAD,
        totalCAD,
        appliedRule: pricing.appliedRule,
        taxRate: getTaxRate(vendor.province),
        province: vendor.province,
      },
    });
  } catch (err) { next(err); }
});

// GET /api/v1/vendor/walkin/history — today's walk-in summary
router.get("/walkin/history", async (req, res, next) => {
  try {
    const vendor = await prisma.vendor.findUnique({
      where: { userId: req.user!.sub as string },
      select: { id: true, userId: true },
    });
    if (!vendor) { res.status(404).json({ message: "Vendor not found" }); return; }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const walkins = await prisma.booking.findMany({
      where: {
        userId: vendor.userId,
        notes: { startsWith: "Walk-in" },
        createdAt: { gte: today, lt: tomorrow },
      },
      orderBy: { createdAt: "asc" },
    });

    const paid = walkins.filter(
      (b) => b.paymentStatus === BookingPaymentStatus.PAID || b.status === BookingStatus.CONFIRMED
    );
    const totalRevenue = Math.round(
      paid.reduce((sum, b) => sum + Number(b.totalCAD), 0) * 100
    ) / 100;

    res.json({
      data: {
        bookings: walkins.map((b) => ({
          id: b.id,
          notes: b.notes,
          totalCAD: Number(b.totalCAD),
          status: b.status,
          paymentStatus: b.paymentStatus,
          createdAt: b.createdAt,
        })),
        totalRevenue,
        count: walkins.length,
      },
    });
  } catch (err) { next(err); }
});

// GET /api/v1/vendor/walkin/:bookingId/status — poll for payment completion
router.get("/walkin/:bookingId/status", async (req, res, next) => {
  try {
    const bookingId = param(req.params["bookingId"]!);
    const vendor = await prisma.vendor.findUnique({
      where: { userId: req.user!.sub as string },
      select: { userId: true },
    });
    if (!vendor) { res.status(404).json({ message: "Vendor not found" }); return; }

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, userId: vendor.userId },
      select: { status: true, paymentStatus: true },
    });
    if (!booking) { res.status(404).json({ message: "Booking not found" }); return; }

    const isPaid =
      booking.paymentStatus === BookingPaymentStatus.PAID ||
      booking.status === BookingStatus.CONFIRMED;

    res.json({ data: { status: isPaid ? "PAID" : "PENDING" } });
  } catch (err) { next(err); }
});

// POST /api/v1/vendor/walkin — create walk-in booking + QR code
router.post("/walkin", validate(walkinSchema), async (req, res, next) => {
  try {
    const { courtId, facilityId, date, startTime, durationMinutes, sport, playerName, playerPhone } =
      req.body as z.infer<typeof walkinSchema>;

    if (!courtId || !facilityId || !date || !startTime || !durationMinutes || !sport) {
      res.status(422).json({ message: "Missing required fields" });
      return;
    }

    const vendor = await prisma.vendor.findFirst({
      where: { userId: req.user!.sub as string },
      select: { id: true, province: true, userId: true },
    });
    if (!vendor) { res.status(404).json({ message: "Vendor not found" }); return; }

    const facility = await prisma.facility.findFirst({
      where: { id: facilityId, vendorId: vendor.id },
      select: { id: true, name: true },
    });
    if (!facility) {
      res.status(404).json({ message: "Facility not found" });
      return;
    }

    const court = await prisma.court.findFirst({
      where: { id: courtId, facilityId },
      select: { id: true, name: true },
    });
    if (!court) {
      res.status(404).json({ message: "Court not found" });
      return;
    }

    const endTime = addMinutesToTime(startTime, durationMinutes);
    const dateObj = new Date(date);

    // Check availability: no BOOKED slots overlapping this time range
    const conflict = await prisma.slot.findFirst({
      where: {
        courtId,
        date: dateObj,
        status: SlotStatus.BOOKED,
        OR: [
          { startTime: { gte: startTime, lt: endTime } },
          { endTime: { gt: startTime, lte: endTime } },
          { AND: [{ startTime: { lte: startTime } }, { endTime: { gte: endTime } }] },
        ],
      },
    });
    if (conflict) {
      res.status(409).json({ message: "Court is not available for this time slot" });
      return;
    }

    // Calculate price
    const basePricePerHour = await getBaseHourlyRate(courtId, sport);
    const basePriceCAD = (basePricePerHour / 60) * durationMinutes;
    const pricing = await calculateSlotPrice(courtId, dateObj, startTime, endTime, basePriceCAD);
    const { subtotalCAD, taxCAD, totalCAD } = calculateTotal(pricing.finalPriceCAD, vendor.province);

    const facilityName = facility.name;
    const courtName = court.name;
    const sportLabel = sport.charAt(0).toUpperCase() + sport.slice(1).toLowerCase();
    const guestName = playerName ?? "Walk-in Player";

    const booking = await prisma.booking.create({
      data: {
        facilityId,
        slotId: null,
        userId: vendor.userId,
        status: BookingStatus.PENDING,
        paymentStatus: BookingPaymentStatus.UNPAID,
        subtotalCAD,
        taxCAD,
        totalCAD,
        taxProvince: vendor.province,
        notes: `Walk-in · ${guestName}`,
        paymentIntentId: null,
      },
    });

    const paymentLink = await stripe.paymentLinks.create({
      line_items: [
        {
          price_data: {
            currency: "cad",
            product_data: {
              name: `${sportLabel} at ${facilityName}`,
              description: `${date} · ${startTime}–${endTime} · ${courtName}`,
            },
            unit_amount: Math.round(totalCAD * 100),
          },
          quantity: 1,
        },
      ],
      after_completion: {
        type: "redirect",
        redirect: { url: "https://dome-monorepo-production.up.railway.app/payment-success" },
      },
      metadata: {
        courtId,
        facilityId,
        bookingId: booking.id,
        date,
        startTime,
        endTime,
        durationMinutes: String(durationMinutes),
        sport,
        playerName: guestName,
        playerPhone: playerPhone ?? "",
        type: "WALKIN",
        vendorId: vendor.id,
      },
      tax_id_collection: { enabled: false },
      phone_number_collection: { enabled: false },
      custom_text: {
        submit: { message: `Pay for ${sportLabel} at ${facilityName}` },
      },
    });

    if (!paymentLink.url) {
      res.status(502).json({ message: "Unable to create Stripe payment link" });
      return;
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        notes: `Walk-in · ${guestName} · ${paymentLink.id}`,
        paymentIntentId: paymentLink.id,
      },
    });

    const qrCodeDataUrl = await QRCode.toDataURL(paymentLink.url, {
      width: 300,
      margin: 2,
      color: { dark: "#0A0A0A", light: "#FFFFFF" },
    });

    res.json({
      data: {
        bookingId: updatedBooking.id,
        paymentLinkUrl: paymentLink.url,
        qrCodeDataUrl,
        totalCAD,
        subtotalCAD,
        taxCAD,
        sport,
        courtName,
        facilityName,
        startTime,
        endTime,
        date,
        playerName: guestName,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      },
    });
  } catch (err) {
    console.error("Walk-in creation error:", err);
    console.error("Walk-in body:", req.body);
    console.error("Walk-in user:", req.user);
    next(err);
  }
});

export default router;
