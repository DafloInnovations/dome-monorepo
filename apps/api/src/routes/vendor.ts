import { Router } from "express";
import { z } from "zod";
import { BookingStatus, BookingUnitType, OpenGameStatus, Prisma, SlotStatus } from "@prisma/client";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createFacility, updateFacility } from "../services/facilities.service";
import { bulkCreateSlots, createCourt } from "../services/courts.service";
import { prisma } from "../lib/prisma";

const router = Router();

// ─── Pre-auth routes (authenticate only, no VENDOR role required) ─────────────

const applySchema = z.object({
  businessName:  z.string().min(2).max(100),
  businessEmail: z.string().email(),
  businessPhone: z.string().min(10),
  website:       z.string().url().optional().or(z.literal("")),
  streetAddress: z.string().min(3),
  city:          z.string().min(2),
  province:      z.string().length(2),
  postalCode:    z.string().min(6).max(7),
  sports:        z.array(z.string()).min(1),
  description:   z.string().min(20).max(2000),
  agreedToTerms: z.literal(true),
});

// POST /api/v1/vendor/apply — any authenticated user can apply
router.post("/apply", authenticate, validate(applySchema), async (req, res, next) => {
  try {
    const userId = req.user!.sub as string;
    const body = req.body as z.infer<typeof applySchema>;

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

    const provinceEnum = body.province.toUpperCase() as "ON" | "BC" | "AB" | "QC" | "MB" | "SK" | "NS" | "NB" | "NL" | "PE" | "NT" | "NU" | "YT";

    if (existing) {
      // Re-application after rejection
      await prisma.vendor.update({
        where: { userId },
        data: {
          businessName: body.businessName,
          businessEmail: body.businessEmail,
          businessPhone: body.businessPhone,
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
            businessPhone: body.businessPhone,
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
    }

    res.status(201).json({ data: { status: "PENDING", message: "Application submitted successfully. We'll notify you within 24–48 hours." } });
  } catch (err) { next(err); }
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

router.use(authenticate, requireRole("VENDOR"));

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
        courts: { select: { id: true, name: true, isActive: true } },
        _count: { select: { bookings: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ data: facilities });
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
});

// ─── Court schemas ────────────────────────────────────────────────────────────

const createCourtSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  unitType: z.nativeEnum(BookingUnitType).optional(),
  unitLabel: z.string().min(1).max(40).optional(),
  maxPlayers: z.number().int().positive().optional(),
});

const bulkSlotsSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  weekdays: z.array(z.number().int().min(0).max(6)).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "HH:mm"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "HH:mm"),
  slotDurationMinutes: z.number().int().positive(),
  priceCAD: z.number().positive(),
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

// POST /api/v1/vendor/courts/:id/slots/bulk
router.post("/courts/:id/slots/bulk", validate(bulkSlotsSchema), async (req, res, next) => {
  try {
    const courtId = Array.isArray(req.params["id"])
      ? req.params["id"][0]!
      : req.params["id"]!;
    const result = await bulkCreateSlots(req.user!.sub, courtId, req.body);
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
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
      where: { id: booking.slotId },
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

export default router;
