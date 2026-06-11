import { Router } from "express";
import { z } from "zod";
import { BookingStatus, UserRole, VendorStatus } from "@prisma/client";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { prisma } from "../lib/prisma";
import { sendPushNotification, saveNotification } from "../lib/firebase";
import { sendVendorApplicationApproved, sendVendorApplicationRejected } from "../lib/email";
import { updateCourtShared, upsertSportPricing } from "../services/courts.service";
import {
  createCoupon,
  updateCoupon,
  deactivateCoupon,
  listCoupons,
  getCouponUsages,
} from "../services/coupon.service";

const router = Router();

router.use(authenticate, requireRole("ADMIN"));

function param(p: string | string[]): string {
  return Array.isArray(p) ? p[0]! : p;
}

// ─── GET /api/v1/admin/vendors/pending ───────────────────────────────────────

router.get("/vendors/pending", async (req, res, next) => {
  try {
    const vendors = await prisma.vendor.findMany({
      where: { status: VendorStatus.PENDING },
      include: {
        user: {
          select: { id: true, phone: true, firstName: true, lastName: true, createdAt: true },
        },
      },
      orderBy: { submittedAt: "asc" },
    });
    res.json({ data: vendors });
  } catch (err) { next(err); }
});

// ─── GET /api/v1/admin/vendors ───────────────────────────────────────────────

router.get("/vendors", async (req, res, next) => {
  try {
    const { status, page = "1", limit = "20" } = req.query as Record<string, string>;
    const take = Math.min(Number(limit), 100);
    const skip = (Math.max(Number(page), 1) - 1) * take;

    const where = status ? { status: status as VendorStatus } : {};
    const [vendors, total] = await Promise.all([
      prisma.vendor.findMany({
        where,
        include: {
          user: { select: { id: true, phone: true, firstName: true, lastName: true } },
          _count: { select: { facilities: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.vendor.count({ where }),
    ]);
    res.json({ data: vendors, total, page: Number(page), limit: take });
  } catch (err) { next(err); }
});

// ─── PUT /api/v1/admin/vendors/:vendorId/approve ─────────────────────────────

router.put("/vendors/:vendorId/approve", async (req, res, next) => {
  try {
    const vendorId = param(req.params["vendorId"]!);
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: { user: { select: { id: true, deviceToken: true, firstName: true, email: true } } },
    });
    if (!vendor) { res.status(404).json({ message: "Vendor not found" }); return; }
    if (vendor.status === VendorStatus.APPROVED) {
      res.status(409).json({ message: "Already approved" }); return;
    }

    await prisma.vendor.update({
      where: { id: vendorId },
      data: { status: VendorStatus.APPROVED, approvedAt: new Date(), rejectionReason: null },
    });

    // Notify vendor
    const title = "Application Approved! 🎉";
    const body  = `Welcome to Dome, ${vendor.user.firstName || vendor.businessName}! Your vendor account is ready.`;
    const data  = { type: "vendor_approved", vendorId };
    await saveNotification(vendor.user.id, "BOOKING_CONFIRMED", title, body, data);
    if (vendor.user.deviceToken) {
      await sendPushNotification(vendor.user.deviceToken, title, body, data);
    }
    sendVendorApplicationApproved(vendor.user.email, {
      vendorFirstName: vendor.user.firstName || vendor.businessName,
      businessName: vendor.businessName,
    }).catch(() => null);

    res.json({ data: { status: "APPROVED", message: "Vendor approved" } });
  } catch (err) { next(err); }
});

// ─── PUT /api/v1/admin/vendors/:vendorId/reject ──────────────────────────────

const rejectSchema = z.object({
  reason: z.string().min(10).max(500),
});

router.put("/vendors/:vendorId/reject", validate(rejectSchema), async (req, res, next) => {
  try {
    const vendorId = param(req.params["vendorId"]!);
    const { reason } = req.body as z.infer<typeof rejectSchema>;

    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: { user: { select: { id: true, deviceToken: true, firstName: true, email: true } } },
    });
    if (!vendor) { res.status(404).json({ message: "Vendor not found" }); return; }

    await prisma.vendor.update({
      where: { id: vendorId },
      data: { status: VendorStatus.REJECTED, rejectionReason: reason },
    });

    const title = "Application Update";
    const body  = `Your Dome vendor application was not approved. Reason: ${reason.slice(0, 80)}`;
    const data  = { type: "vendor_rejected", vendorId, reason };
    await saveNotification(vendor.user.id, "BOOKING_CANCELLED", title, body, data);
    if (vendor.user.deviceToken) {
      await sendPushNotification(vendor.user.deviceToken, title, body, data);
    }
    sendVendorApplicationRejected(vendor.user.email, {
      vendorFirstName: vendor.user.firstName || vendor.businessName,
      reason,
    }).catch(() => null);

    res.json({ data: { status: "REJECTED", message: "Vendor rejected" } });
  } catch (err) { next(err); }
});

// ─── GET /api/v1/admin/vendors/:vendorId ─────────────────────────────────────

router.get("/vendors/:vendorId", async (req, res, next) => {
  try {
    const vendorId = param(req.params["vendorId"]!);
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        user: { select: { id: true, phone: true, firstName: true, lastName: true, province: true, createdAt: true } },
        facilities: { select: { id: true, name: true, sport: true, isActive: true, _count: { select: { bookings: true } } } },
      },
    });
    if (!vendor) { res.status(404).json({ message: "Vendor not found" }); return; }
    res.json({ data: vendor });
  } catch (err) { next(err); }
});

// ─── GET /api/v1/admin/stats ─────────────────────────────────────────────────

router.get("/stats", async (req, res, next) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart  = new Date(now.getTime() - 7 * 24 * 3_600_000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers, totalVendors, pendingVendors,
      totalBookingsToday, newUsersToday, newUsersWeek,
      revenueRows,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.vendor.count({ where: { status: VendorStatus.APPROVED } }),
      prisma.vendor.count({ where: { status: VendorStatus.PENDING } }),
      prisma.booking.count({ where: { slot: { date: { gte: todayStart } }, status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] } } }),
      prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.user.count({ where: { createdAt: { gte: weekStart } } }),
      prisma.booking.findMany({
        where: { status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] }, createdAt: { gte: monthStart } },
        select: { totalCAD: true },
      }),
    ]);

    const totalRevenueMonth = revenueRows.reduce((s, b) => s + Number(b.totalCAD), 0);

    res.json({
      data: {
        totalUsers, totalVendors, pendingVendors,
        totalBookingsToday, newUsersToday, newUsersThisWeek: newUsersWeek,
        totalRevenueMonth: Math.round(totalRevenueMonth * 100) / 100,
      },
    });
  } catch (err) { next(err); }
});

// ─── GET /api/v1/admin/users ─────────────────────────────────────────────────

router.get("/users", async (req, res, next) => {
  try {
    const { phone, page = "1", limit = "25" } = req.query as Record<string, string>;
    const take = Math.min(Number(limit), 100);
    const skip = (Math.max(Number(page), 1) - 1) * take;
    const where = phone ? { phone: { contains: phone } } : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, phone: true, firstName: true, lastName: true,
          role: true, province: true, creditBalanceCAD: true, createdAt: true,
          _count: { select: { bookings: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      data: users.map((u) => ({ ...u, creditBalanceCAD: Number(u.creditBalanceCAD) })),
      total, page: Number(page), limit: take,
    });
  } catch (err) { next(err); }
});

// ─── GET /api/v1/admin/users/:userId ─────────────────────────────────────────

router.get("/users/:userId", async (req, res, next) => {
  try {
    const userId = param(req.params["userId"]!);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        vendor: { select: { id: true, businessName: true, status: true } },
        bookings: {
          include: {
            slot: { select: { date: true, startTime: true, endTime: true } },
            facility: { select: { id: true, name: true, sport: true, address: { select: { city: true } } } },
            payment: { select: { status: true, amountCAD: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        },
        domeCredits: { orderBy: { createdAt: "desc" }, take: 30 },
        _count: { select: { bookings: true } },
      },
    });
    if (!user) { res.status(404).json({ message: "User not found" }); return; }
    res.json({
      data: {
        ...user,
        creditBalanceCAD: Number(user.creditBalanceCAD),
        bookings: user.bookings.map((b) => ({
          ...b,
          totalCAD: Number(b.totalCAD),
          subtotalCAD: Number(b.subtotalCAD),
          taxCAD: Number(b.taxCAD),
          payment: b.payment ? { ...b.payment, amountCAD: Number(b.payment.amountCAD) } : null,
          slot: {
            ...b.slot,
            date: b.slot.date instanceof Date ? b.slot.date.toISOString().split("T")[0]! : String(b.slot.date),
          },
        })),
        domeCredits: user.domeCredits.map((c) => ({ ...c, amountCAD: Number(c.amountCAD) })),
      },
    });
  } catch (err) { next(err); }
});

// ─── PUT /api/v1/admin/users/:userId/role ────────────────────────────────────

const roleSchema = z.object({
  role: z.nativeEnum(UserRole),
});

router.put("/users/:userId/role", validate(roleSchema), async (req, res, next) => {
  try {
    const userId = param(req.params["userId"]!);
    const { role } = req.body as z.infer<typeof roleSchema>;
    const updated = await prisma.user.update({ where: { id: userId }, data: { role } });
    res.json({ data: { id: updated.id, role: updated.role } });
  } catch (err) { next(err); }
});

// ─── GET /api/v1/admin/bookings ──────────────────────────────────────────────

router.get("/bookings", async (req, res, next) => {
  try {
    const { status, from, to, sport, page = "1", limit = "25" } = req.query as Record<string, string>;
    const take = Math.min(Number(limit), 100);
    const skip = (Math.max(Number(page), 1) - 1) * take;

    const where: Record<string, unknown> = {};
    if (status) where["status"] = status as BookingStatus;
    if (from)   where["slot"] = { date: { gte: new Date(from), ...(to ? { lte: new Date(to) } : {}) } };
    if (sport)  where["facility"] = { sport: sport.toUpperCase() };

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          slot: { include: { court: { select: { name: true } } } },
          facility: { select: { id: true, name: true, sport: true, address: { select: { city: true } } } },
          user: { select: { id: true, phone: true, firstName: true, lastName: true } },
          payment: { select: { status: true, amountCAD: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.booking.count({ where }),
    ]);

    res.json({
      data: bookings.map((b) => ({ ...b, totalCAD: Number(b.totalCAD), subtotalCAD: Number(b.subtotalCAD), taxCAD: Number(b.taxCAD) })),
      total, page: Number(page), limit: take,
    });
  } catch (err) { next(err); }
});

// ─── GET /api/v1/admin/revenue ───────────────────────────────────────────────

router.get("/revenue", async (req, res, next) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3_600_000);
    const monthStart    = new Date(now.getFullYear(), now.getMonth(), 1);

    const bookings = await prisma.booking.findMany({
      where: { status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] } },
      select: {
        totalCAD: true, createdAt: true,
        facility: {
          select: {
            sport: true,
            vendorId: true,
            address: { select: { city: true } },
            vendor: { select: { businessName: true } },
          },
        },
      },
    });

    const totalRevenueAllTime = bookings.reduce((s, b) => s + Number(b.totalCAD), 0);
    const monthBookings = bookings.filter((b) => b.createdAt >= monthStart);
    const totalRevenueMonth = monthBookings.reduce((s, b) => s + Number(b.totalCAD), 0);

    // Revenue by day (last 30 days)
    const revenueMap: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(thirtyDaysAgo.getTime() + i * 24 * 3_600_000);
      revenueMap[d.toISOString().split("T")[0]!] = 0;
    }
    for (const b of bookings) {
      const day = b.createdAt.toISOString().split("T")[0]!;
      if (day in revenueMap) revenueMap[day]! += Number(b.totalCAD);
    }
    const revenueByDay = Object.entries(revenueMap).map(([date, amount]) => ({ date, amount: Math.round(amount * 100) / 100 }));

    // Revenue by city
    const cityMap: Record<string, number> = {};
    for (const b of bookings) {
      const city = b.facility.address?.city ?? "Unknown";
      cityMap[city] = (cityMap[city] ?? 0) + Number(b.totalCAD);
    }
    const revenueByCity = Object.entries(cityMap).sort(([, a], [, b]) => b - a).slice(0, 10)
      .map(([city, amount]) => ({ city, amount: Math.round(amount * 100) / 100 }));

    // Revenue by sport
    const sportMap: Record<string, number> = {};
    for (const b of bookings) {
      const sport = b.facility.sport as string;
      sportMap[sport] = (sportMap[sport] ?? 0) + Number(b.totalCAD);
    }
    const revenueBySport = Object.entries(sportMap).sort(([, a], [, b]) => b - a)
      .map(([sport, amount]) => ({ sport, amount: Math.round(amount * 100) / 100 }));

    // Top vendors
    const vendorMap: Record<string, { businessName: string; amount: number; bookings: number }> = {};
    for (const b of bookings) {
      const vid  = b.facility.vendorId;
      const name = b.facility.vendor?.businessName ?? vid;
      if (!vendorMap[vid]) vendorMap[vid] = { businessName: name, amount: 0, bookings: 0 };
      vendorMap[vid]!.amount   += Number(b.totalCAD);
      vendorMap[vid]!.bookings += 1;
    }
    const topVendors = Object.entries(vendorMap)
      .sort(([, a], [, b]) => b.amount - a.amount).slice(0, 10)
      .map(([vendorId, v]) => ({ vendorId, ...v, amount: Math.round(v.amount * 100) / 100 }));

    // Dome commission (2.9% + $0.30 per booking)
    const domeCommission = bookings.reduce((s, b) => s + Number(b.totalCAD) * 0.029 + 0.30, 0);

    res.json({
      data: {
        totalRevenueAllTime: Math.round(totalRevenueAllTime * 100) / 100,
        totalRevenueMonth:   Math.round(totalRevenueMonth * 100) / 100,
        domeCommission:      Math.round(domeCommission * 100) / 100,
        revenueByDay,
        revenueByCity,
        revenueBySport,
        topVendors,
        totalBookings: bookings.length,
      },
    });
  } catch (err) { next(err); }
});

// ─── GET /api/v1/admin/activity ──────────────────────────────────────────────

router.get("/activity", async (req, res, next) => {
  try {
    const limit = Math.min(Number((req.query as Record<string, string>)["limit"] ?? "20"), 50);

    const [recentUsers, recentBookings, recentVendors] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        select: { id: true, phone: true, firstName: true, lastName: true, createdAt: true },
      }),
      prisma.booking.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          status: true,
          totalCAD: true,
          createdAt: true,
          user: { select: { firstName: true, lastName: true, phone: true } },
          facility: { select: { name: true } },
        },
      }),
      prisma.vendor.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        select: { id: true, businessName: true, status: true, createdAt: true, submittedAt: true },
      }),
    ]);

    type ActivityEvent = {
      id: string;
      type: "user_signup" | "booking_created" | "booking_cancelled" | "vendor_applied";
      title: string;
      sub: string;
      createdAt: string;
      href?: string;
    };

    const events: ActivityEvent[] = [
      ...recentUsers.map((u) => ({
        id: `user-${u.id}`,
        type: "user_signup" as const,
        title: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.phone,
        sub: "New user signed up",
        createdAt: u.createdAt.toISOString(),
        href: `/dashboard/users/${u.id}`,
      })),
      ...recentBookings.map((b) => ({
        id: `booking-${b.id}`,
        type: b.status === "CANCELLED" ? "booking_cancelled" as const : "booking_created" as const,
        title: b.facility.name,
        sub: b.status === "CANCELLED"
          ? `Booking cancelled — C$${Number(b.totalCAD).toFixed(2)}`
          : `New booking — C$${Number(b.totalCAD).toFixed(2)} by ${b.user.firstName || b.user.phone}`,
        createdAt: b.createdAt.toISOString(),
      })),
      ...recentVendors.map((v) => ({
        id: `vendor-${v.id}`,
        type: "vendor_applied" as const,
        title: v.businessName,
        sub: `Vendor application (${v.status.toLowerCase()})`,
        createdAt: (v.submittedAt ?? v.createdAt).toISOString(),
        href: `/dashboard/vendors/${v.id}`,
      })),
    ];

    events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({ data: events.slice(0, limit) });
  } catch (err) { next(err); }
});

// ─── PUT /api/v1/admin/courts/:courtId/shared ────────────────────────────────

// ─── Admin coupon endpoints ──────────────────────────────────────────────────

const couponBodySchema = z.object({
  code:              z.string().min(2).max(30).optional(),
  description:       z.string().max(200).optional(),
  type:              z.enum(["PERCENTAGE", "FIXED", "FREE"]),
  value:             z.number().positive(),
  vendorId:          z.string().optional().nullable(),
  facilityId:        z.string().optional().nullable(),
  sport:             z.string().optional().nullable(),
  minBookingCAD:     z.number().positive().optional().nullable(),
  maxDiscountCAD:    z.number().positive().optional().nullable(),
  usageLimit:        z.number().int().positive().optional().nullable(),
  usageLimitPerUser: z.number().int().positive().optional().nullable(),
  validFrom:         z.string(),
  validUntil:        z.string(),
});

router.get("/coupons", async (req, res, next) => {
  try {
    const { vendorId, isActive, type, page, limit } = req.query as Record<string, string | undefined>;
    const result = await listCoupons({
      vendorId: vendorId === "null" ? null : vendorId,
      isActive: isActive !== undefined ? isActive === "true" : undefined,
      type: type as "PERCENTAGE" | "FIXED" | "FREE" | undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    });
    res.json(result);
  } catch (err) { next(err); }
});

router.post("/coupons", validate(couponBodySchema), async (req, res, next) => {
  try {
    const data = await createCoupon(req.body as z.infer<typeof couponBodySchema>, req.user!.sub as string);
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

router.put("/coupons/:id", validate(couponBodySchema.partial()), async (req, res, next) => {
  try {
    const data = await updateCoupon(param(req.params["id"]!), req.body as z.infer<typeof couponBodySchema>);
    res.json({ data });
  } catch (err) { next(err); }
});

router.delete("/coupons/:id", async (req, res, next) => {
  try {
    const data = await deactivateCoupon(param(req.params["id"]!));
    res.json({ data });
  } catch (err) { next(err); }
});

router.get("/coupons/:id/usages", async (req, res, next) => {
  try {
    const { page, limit } = req.query as Record<string, string | undefined>;
    const data = await getCouponUsages(param(req.params["id"]!), Number(page ?? 1), Number(limit ?? 50));
    res.json(data);
  } catch (err) { next(err); }
});

// ─── Admin shared court endpoint (kept below coupon routes) ──────────────────

const adminSportEnum = z.enum([
  "SOCCER", "BASKETBALL", "TENNIS", "BADMINTON", "VOLLEYBALL",
  "HOCKEY", "SQUASH", "PICKLEBALL", "BASEBALL", "CRICKET",
]);

const adminSharedCourtSchema = z.object({
  isShared: z.boolean(),
  sports: z.array(adminSportEnum).max(10).optional(),
  primarySport: adminSportEnum.optional(),
  sportPricing: z.array(z.object({
    sport: adminSportEnum,
    priceCAD: z.number().positive(),
  })).optional(),
});

router.put("/courts/:courtId/shared", validate(adminSharedCourtSchema), async (req, res, next) => {
  try {
    const courtId = param(req.params["courtId"]!);
    const body = req.body as z.infer<typeof adminSharedCourtSchema>;

    // Admin can configure any court — look up owning vendor user
    const court = await prisma.court.findUnique({
      where: { id: courtId },
      include: { facility: { include: { vendor: { select: { userId: true } } } } },
    });
    if (!court) { res.status(404).json({ message: "Court not found" }); return; }

    const vendorUserId = court.facility.vendor?.userId;
    if (!vendorUserId) { res.status(404).json({ message: "Court has no owning vendor" }); return; }

    const updated = await updateCourtShared(vendorUserId, courtId, body);
    if (body.sportPricing && body.sportPricing.length > 0) {
      await upsertSportPricing(vendorUserId, courtId, body.sportPricing);
    }
    res.json({ data: updated });
  } catch (err) { next(err); }
});

export default router;
