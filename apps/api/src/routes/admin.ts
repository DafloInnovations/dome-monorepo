import { Router } from "express";
import { z } from "zod";
import { VendorStatus } from "@prisma/client";
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

export default router;
