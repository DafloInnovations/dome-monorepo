import { CouponType } from "@prisma/client";
import { prisma } from "../lib/prisma";

function appError(msg: string, status = 500, code?: string) {
  return Object.assign(new Error(msg), { status, code });
}

function generateCode(prefix = "DOME"): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rand = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${prefix}-${rand}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CouponValidateResult {
  valid: true;
  couponId: string;
  code: string;
  description: string | null;
  type: CouponType;
  discountCAD: number;
  finalTotal: number;
}

export interface CouponInvalidResult {
  valid: false;
  error: string;
}

export type CouponResult = CouponValidateResult | CouponInvalidResult;

export interface CreateCouponInput {
  code?: string;
  description?: string;
  type: CouponType;
  value: number;
  vendorId?: string | null;
  facilityId?: string | null;
  sport?: string | null;
  minBookingCAD?: number | null;
  maxDiscountCAD?: number | null;
  usageLimit?: number | null;
  usageLimitPerUser?: number | null;
  validFrom: Date | string;
  validUntil: Date | string;
}

// ─── Validate coupon (read-only preview) ─────────────────────────────────────

export async function validateCoupon(
  code: string,
  userId: string,
  facilityId: string,
  subtotalCAD: number
): Promise<CouponResult> {
  const coupon = await prisma.coupon.findFirst({
    where: { code: { equals: code.toUpperCase().trim(), mode: "insensitive" }, isActive: true },
  });

  if (!coupon) return { valid: false, error: "Invalid coupon code" };

  const now = new Date();
  if (now < coupon.validFrom) return { valid: false, error: "This coupon is not yet active" };
  if (now > coupon.validUntil) return { valid: false, error: "This coupon has expired" };

  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return { valid: false, error: "This coupon has reached its usage limit" };
  }

  if (coupon.usageLimitPerUser !== null) {
    const userUsages = await prisma.couponUsage.count({ where: { couponId: coupon.id, userId } });
    if (userUsages >= coupon.usageLimitPerUser) {
      return { valid: false, error: "You've already used this coupon" };
    }
  }

  if (coupon.minBookingCAD !== null && subtotalCAD < Number(coupon.minBookingCAD)) {
    return {
      valid: false,
      error: `Minimum booking of C$${Number(coupon.minBookingCAD).toFixed(2)} required`,
    };
  }

  // Facility-scoped check
  if (coupon.facilityId && coupon.facilityId !== facilityId) {
    return { valid: false, error: "This coupon is not valid for this facility" };
  }

  // Vendor-scoped check: verify facility belongs to vendor
  if (coupon.vendorId && !coupon.facilityId) {
    const facility = await prisma.facility.findFirst({
      where: { id: facilityId, vendor: { id: coupon.vendorId } },
      select: { id: true },
    });
    if (!facility) return { valid: false, error: "This coupon is not valid for this facility" };
  }

  // Sport check
  if (coupon.sport) {
    const facility = await prisma.facility.findUnique({
      where: { id: facilityId },
      select: { sport: true },
    });
    if (facility?.sport && facility.sport.toUpperCase() !== coupon.sport.toUpperCase()) {
      return { valid: false, error: `This coupon is only valid for ${coupon.sport}` };
    }
  }

  const discountCAD = calcDiscount(coupon.type, Number(coupon.value), Number(coupon.maxDiscountCAD ?? null), subtotalCAD);

  return {
    valid: true,
    couponId: coupon.id,
    code: coupon.code,
    description: coupon.description,
    type: coupon.type,
    discountCAD,
    finalTotal: Math.max(0, Math.round((subtotalCAD - discountCAD) * 100) / 100),
  };
}

function calcDiscount(
  type: CouponType,
  value: number,
  maxDiscountCAD: number | null,
  subtotalCAD: number
): number {
  let discount: number;
  switch (type) {
    case "PERCENTAGE":
      discount = Math.round(subtotalCAD * (value / 100) * 100) / 100;
      if (maxDiscountCAD !== null) discount = Math.min(discount, maxDiscountCAD);
      break;
    case "FIXED":
      discount = Math.min(value, subtotalCAD);
      break;
    case "FREE":
      discount = subtotalCAD;
      break;
  }
  return Math.round(discount * 100) / 100;
}

// ─── Apply coupon to a booking (mutating) ─────────────────────────────────────

export async function applyCoupon(
  couponId: string,
  userId: string,
  bookingId: string,
  discountCAD: number
) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    select: { id: true, subtotalCAD: true, taxCAD: true, totalCAD: true, couponUsage: { select: { id: true } } },
  });
  if (!booking) throw appError("Booking not found", 404);
  if (booking.couponUsage) throw appError("Coupon already applied to this booking", 409);

  const coupon = await prisma.coupon.findUnique({ where: { id: couponId } });
  if (!coupon || !coupon.isActive) throw appError("Coupon not found", 404);

  const newTotal = Math.max(0, Math.round((Number(booking.totalCAD) - discountCAD) * 100) / 100);

  await prisma.$transaction([
    prisma.couponUsage.create({
      data: { couponId, userId, bookingId, discountCAD },
    }),
    prisma.coupon.update({
      where: { id: couponId },
      data: { usedCount: { increment: 1 } },
    }),
    prisma.booking.update({
      where: { id: bookingId },
      data: {
        couponId,
        couponCode: coupon.code,
        discountCAD,
        totalCAD: newTotal,
      },
    }),
  ]);

  return { discountCAD, newTotal };
}

// ─── Remove coupon from a PENDING booking ────────────────────────────────────

export async function removeCoupon(userId: string, bookingId: string) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId, status: "PENDING" },
    select: {
      id: true, subtotalCAD: true, taxCAD: true, discountCAD: true,
      couponId: true, couponUsage: { select: { id: true } },
    },
  });
  if (!booking) throw appError("Booking not found or already confirmed", 404);
  if (!booking.couponUsage) return { removed: false };

  const restoredTotal = Math.round((Number(booking.subtotalCAD) + Number(booking.taxCAD)) * 100) / 100;

  await prisma.$transaction([
    prisma.couponUsage.delete({ where: { bookingId } }),
    prisma.coupon.update({
      where: { id: booking.couponId! },
      data: { usedCount: { decrement: 1 } },
    }),
    prisma.booking.update({
      where: { id: bookingId },
      data: { couponId: null, couponCode: null, discountCAD: null, totalCAD: restoredTotal },
    }),
  ]);

  return { removed: true, restoredTotal };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createCoupon(input: CreateCouponInput, createdBy: string) {
  const code = (input.code ?? generateCode()).toUpperCase().trim();

  const existing = await prisma.coupon.findUnique({ where: { code } });
  if (existing) throw appError(`Coupon code "${code}" is already in use`, 409, "CODE_TAKEN");

  return prisma.coupon.create({
    data: {
      code,
      description: input.description,
      type: input.type,
      value: input.value,
      vendorId: input.vendorId ?? null,
      facilityId: input.facilityId ?? null,
      sport: input.sport ?? null,
      minBookingCAD: input.minBookingCAD ?? null,
      maxDiscountCAD: input.maxDiscountCAD ?? null,
      usageLimit: input.usageLimit ?? null,
      usageLimitPerUser: input.usageLimitPerUser ?? 1,
      validFrom: new Date(input.validFrom),
      validUntil: new Date(input.validUntil),
      createdBy,
      isActive: true,
    },
    include: { vendor: { select: { businessName: true } }, facility: { select: { name: true } } },
  });
}

export async function updateCoupon(id: string, input: Partial<CreateCouponInput>) {
  return prisma.coupon.update({
    where: { id },
    data: {
      ...(input.description !== undefined && { description: input.description }),
      ...(input.type        !== undefined && { type: input.type }),
      ...(input.value       !== undefined && { value: input.value }),
      ...(input.vendorId    !== undefined && { vendorId: input.vendorId }),
      ...(input.facilityId  !== undefined && { facilityId: input.facilityId }),
      ...(input.sport       !== undefined && { sport: input.sport }),
      ...(input.minBookingCAD  !== undefined && { minBookingCAD: input.minBookingCAD }),
      ...(input.maxDiscountCAD !== undefined && { maxDiscountCAD: input.maxDiscountCAD }),
      ...(input.usageLimit     !== undefined && { usageLimit: input.usageLimit }),
      ...(input.usageLimitPerUser !== undefined && { usageLimitPerUser: input.usageLimitPerUser }),
      ...(input.validFrom   !== undefined && { validFrom: new Date(input.validFrom) }),
      ...(input.validUntil  !== undefined && { validUntil: new Date(input.validUntil) }),
    },
    include: { vendor: { select: { businessName: true } }, facility: { select: { name: true } } },
  });
}

export async function deactivateCoupon(id: string) {
  return prisma.coupon.update({
    where: { id },
    data: { isActive: false },
  });
}

export async function listCoupons(filter: {
  vendorId?: string | null;
  facilityId?: string;
  isActive?: boolean;
  type?: CouponType;
  page?: number;
  limit?: number;
}) {
  const { vendorId, facilityId, isActive, type, page = 1, limit = 50 } = filter;
  const skip = (page - 1) * Math.min(limit, 100);
  const take = Math.min(limit, 100);

  const where = {
    ...(vendorId !== undefined && { vendorId }),
    ...(facilityId && { facilityId }),
    ...(isActive   !== undefined && { isActive }),
    ...(type && { type }),
  };

  const [coupons, total] = await Promise.all([
    prisma.coupon.findMany({
      where,
      include: {
        vendor: { select: { businessName: true } },
        facility: { select: { name: true } },
        _count: { select: { usages: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.coupon.count({ where }),
  ]);

  return {
    data: coupons.map((c) => ({
      ...c,
      value: Number(c.value),
      minBookingCAD: c.minBookingCAD !== null ? Number(c.minBookingCAD) : null,
      maxDiscountCAD: c.maxDiscountCAD !== null ? Number(c.maxDiscountCAD) : null,
      usageCount: c._count.usages,
    })),
    total,
    page,
    limit: take,
  };
}

export async function getCouponUsages(couponId: string, page = 1, limit = 50) {
  const skip = (page - 1) * Math.min(limit, 100);
  const take = Math.min(limit, 100);

  const [usages, total] = await Promise.all([
    prisma.couponUsage.findMany({
      where: { couponId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, phone: true } },
        booking: { select: { id: true, totalCAD: true, createdAt: true, facility: { select: { name: true } } } },
      },
      orderBy: { appliedAt: "desc" },
      skip,
      take,
    }),
    prisma.couponUsage.count({ where: { couponId } }),
  ]);

  return {
    data: usages.map((u) => ({
      ...u,
      discountCAD: Number(u.discountCAD),
      booking: { ...u.booking, totalCAD: Number(u.booking.totalCAD) },
    })),
    total,
    page,
    limit: take,
  };
}
