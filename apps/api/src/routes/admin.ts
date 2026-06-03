import { Router } from "express";
import { z } from "zod";
import { BookingStatus, UserRole, VendorStatus } from "@prisma/client";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { prisma } from "../lib/prisma";
import { sendPushNotification, saveNotification } from "../lib/firebase";

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
      include: { user: { select: { id: true, deviceToken: true, firstName: true } } },
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
      include: { user: { select: { id: true, deviceToken: true, firstName: true } } },
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
            facility: { select: { name: true, sport: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        domeCredits: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });
    if (!user) { res.status(404).json({ message: "User not found" }); return; }
    res.json({
      data: {
        ...user,
        creditBalanceCAD: Number(user.creditBalanceCAD),
        bookings: user.bookings.map((b) => ({ ...b, totalCAD: Number(b.totalCAD), subtotalCAD: Number(b.subtotalCAD), taxCAD: Number(b.taxCAD) })),
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
      include: {
        facility: {
          select: {
            sport: true,
            vendorId: true,
            address: { select: { city: true } },
            vendor: { select: { businessName: true } },
          },
        },
      },
      select: {
        totalCAD: true, createdAt: true,
        facility: true,
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

export default router;
