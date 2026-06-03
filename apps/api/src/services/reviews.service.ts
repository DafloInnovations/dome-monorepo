import { BookingStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { sendPushNotification, saveNotification } from "../lib/firebase";

const EDIT_WINDOW_DAYS = 7;

function appError(msg: string, status = 500, code?: string) {
  return Object.assign(new Error(msg), { status, code });
}

// ─── Create review ────────────────────────────────────────────────────────────

export async function createReview(
  userId: string,
  data: {
    bookingId: string;
    rating: number;
    title?: string | null;
    body?: string | null;
    courtQuality?: number | null;
    cleanliness?: number | null;
    valueForMoney?: number | null;
    staffFriendly?: number | null;
  }
) {
  const booking = await prisma.booking.findFirst({
    where: { id: data.bookingId, userId },
    include: {
      slot: true,
      facility: { include: { vendor: { select: { userId: true } } } },
    },
  });
  if (!booking) throw appError("Booking not found", 404);
  if (booking.status !== BookingStatus.CONFIRMED)
    throw appError("Only confirmed bookings can be reviewed", 400, "BOOKING_NOT_CONFIRMED");

  // Booking date must have passed
  const slotDateStr = booking.slot.date.toISOString().split("T")[0]!;
  const today = new Date().toISOString().split("T")[0]!;
  if (slotDateStr >= today)
    throw appError("You can only review after your session has taken place", 400, "BOOKING_IN_FUTURE");

  // One review per booking (enforced by DB unique, but surface a friendly error)
  const existing = await prisma.review.findUnique({ where: { bookingId: data.bookingId } });
  if (existing) throw appError("You have already reviewed this booking", 409, "REVIEW_EXISTS");

  const review = await prisma.review.create({
    data: {
      bookingId: data.bookingId,
      facilityId: booking.facilityId,
      userId,
      rating: data.rating,
      title: data.title ?? null,
      body: data.body ?? null,
      courtQuality: data.courtQuality ?? null,
      cleanliness: data.cleanliness ?? null,
      valueForMoney: data.valueForMoney ?? null,
      staffFriendly: data.staffFriendly ?? null,
      sport: booking.facility.sport,
      isVerified: true,
    },
    include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
  });

  // Notify vendor
  const vendorUser = await prisma.user.findUnique({
    where: { id: booking.facility.vendor.userId },
    select: { deviceToken: true },
  });
  const notifTitle = "New Review ⭐";
  const notifBody = `Someone left a ${data.rating}⭐ review for ${booking.facility.name}`;
  const notifData = { type: "NEW_REVIEW", reviewId: review.id, facilityId: booking.facilityId };
  await saveNotification(booking.facility.vendor.userId, "BOOKING_CONFIRMED", notifTitle, notifBody, notifData);
  if (vendorUser?.deviceToken) {
    await sendPushNotification(vendorUser.deviceToken, notifTitle, notifBody, notifData);
  }

  return review;
}

// ─── Get facility reviews ─────────────────────────────────────────────────────

export async function getFacilityReviews(
  facilityId: string,
  options: {
    page?: number;
    limit?: number;
    sort?: "newest" | "highest" | "lowest";
    minRating?: number;
  } = {}
) {
  const { page = 1, limit = 10, sort = "newest", minRating } = options;
  const take = Math.min(limit, 50);
  const skip = (Math.max(page, 1) - 1) * take;

  const where = {
    facilityId,
    isVisible: true,
    ...(minRating ? { rating: { gte: minRating } } : {}),
  };

  const orderBy =
    sort === "highest" ? { rating: "desc" as const }
    : sort === "lowest" ? { rating: "asc" as const }
    : { createdAt: "desc" as const };

  const [reviews, total, agg, distribution, subRatings] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy,
      take,
      skip,
      include: {
        user: { select: { firstName: true, lastName: true, avatarUrl: true } },
        booking: { include: { slot: { select: { date: true } } } },
      },
    }),
    prisma.review.count({ where }),
    prisma.review.aggregate({
      where: { facilityId, isVisible: true },
      _avg: { rating: true, courtQuality: true, cleanliness: true, valueForMoney: true, staffFriendly: true },
      _count: { id: true },
    }),
    prisma.review.groupBy({
      by: ["rating"],
      where: { facilityId, isVisible: true },
      _count: { id: true },
    }),
    prisma.review.aggregate({
      where: { facilityId, isVisible: true, courtQuality: { not: null } },
      _avg: { courtQuality: true, cleanliness: true, valueForMoney: true, staffFriendly: true },
    }),
  ]);

  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of distribution) dist[row.rating] = row._count.id;

  const round1 = (n: number | null) => (n !== null ? Math.round(n * 10) / 10 : null);

  return {
    reviews,
    summary: {
      averageRating: round1(agg._avg.rating),
      totalReviews: agg._count.id,
      distribution: dist,
      subRatings: {
        courtQuality:   round1(subRatings._avg.courtQuality),
        cleanliness:    round1(subRatings._avg.cleanliness),
        valueForMoney:  round1(subRatings._avg.valueForMoney),
        staffFriendly:  round1(subRatings._avg.staffFriendly),
      },
    },
    page: Math.max(page, 1),
    limit: take,
    total,
    hasMore: skip + take < total,
  };
}

// ─── Pending reviews (bookings with no review yet) ────────────────────────────

export async function getPendingReviews(userId: string) {
  const today = new Date().toISOString().split("T")[0]!;

  const bookings = await prisma.booking.findMany({
    where: {
      userId,
      status: BookingStatus.CONFIRMED,
      slot: { date: { lt: new Date(today) } },
      review: null,
    },
    include: {
      slot: { select: { date: true, startTime: true, endTime: true } },
      facility: { select: { id: true, name: true, sport: true } },
    },
    orderBy: { slot: { date: "desc" } },
    take: 20,
  });
  return bookings;
}

// ─── My reviews ───────────────────────────────────────────────────────────────

export async function getMyReviews(userId: string) {
  return prisma.review.findMany({
    where: { userId },
    include: {
      facility: { select: { id: true, name: true, sport: true } },
      booking: { include: { slot: { select: { date: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// ─── Edit review ──────────────────────────────────────────────────────────────

export async function editReview(
  userId: string,
  reviewId: string,
  data: {
    rating?: number;
    title?: string | null;
    body?: string | null;
    courtQuality?: number | null;
    cleanliness?: number | null;
    valueForMoney?: number | null;
    staffFriendly?: number | null;
  }
) {
  const review = await prisma.review.findFirst({ where: { id: reviewId, userId } });
  if (!review) throw appError("Review not found", 404);

  const ageDays = (Date.now() - review.createdAt.getTime()) / 86_400_000;
  if (ageDays > EDIT_WINDOW_DAYS)
    throw appError(`Reviews can only be edited within ${EDIT_WINDOW_DAYS} days of submission`, 403);

  return prisma.review.update({
    where: { id: reviewId },
    data: {
      ...(data.rating !== undefined && { rating: data.rating }),
      ...(data.title !== undefined && { title: data.title }),
      ...(data.body !== undefined && { body: data.body }),
      ...(data.courtQuality !== undefined && { courtQuality: data.courtQuality }),
      ...(data.cleanliness !== undefined && { cleanliness: data.cleanliness }),
      ...(data.valueForMoney !== undefined && { valueForMoney: data.valueForMoney }),
      ...(data.staffFriendly !== undefined && { staffFriendly: data.staffFriendly }),
    },
    include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
  });
}

// ─── Delete review ────────────────────────────────────────────────────────────

export async function deleteReview(userId: string, reviewId: string) {
  const review = await prisma.review.findFirst({ where: { id: reviewId, userId } });
  if (!review) throw appError("Review not found", 404);
  await prisma.review.delete({ where: { id: reviewId } });
  return { deleted: true };
}

// ─── Vendor reply ─────────────────────────────────────────────────────────────

export async function addVendorReply(vendorUserId: string, reviewId: string, reply: string) {
  const review = await prisma.review.findFirst({
    where: { id: reviewId, facility: { vendor: { userId: vendorUserId } } },
    include: {
      user: { select: { id: true, deviceToken: true } },
      facility: { select: { name: true } },
    },
  });
  if (!review) throw appError("Review not found", 404);

  const updated = await prisma.review.update({
    where: { id: reviewId },
    data: { vendorReply: reply, vendorRepliedAt: new Date() },
  });

  // Notify the reviewer
  const notifTitle = `${review.facility.name} replied to your review`;
  const notifBody = reply.slice(0, 100);
  const notifData = { type: "VENDOR_REPLY", reviewId, facilityId: review.facilityId };
  await saveNotification(review.user.id, "BOOKING_CONFIRMED", notifTitle, notifBody, notifData);
  if (review.user.deviceToken) {
    await sendPushNotification(review.user.deviceToken, notifTitle, notifBody, notifData);
  }

  return updated;
}

// ─── Flag review ──────────────────────────────────────────────────────────────

export async function flagReview(reviewId: string, reason: string) {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw appError("Review not found", 404);
  return prisma.review.update({
    where: { id: reviewId },
    data: { flaggedAt: new Date(), flagReason: reason },
  });
}

// ─── Vendor reviews (all facilities) ─────────────────────────────────────────

export async function getVendorReviews(
  vendorUserId: string,
  options: {
    facilityId?: string;
    rating?: number;
    hasReply?: boolean;
    sort?: "newest" | "lowest";
    page?: number;
    limit?: number;
  } = {}
) {
  const { facilityId, rating, hasReply, sort = "newest", page = 1, limit = 20 } = options;
  const take = Math.min(limit, 50);
  const skip = (Math.max(page, 1) - 1) * take;

  const where = {
    facility: { vendor: { userId: vendorUserId } },
    isVisible: true,
    ...(facilityId && { facilityId }),
    ...(rating !== undefined && { rating }),
    ...(hasReply === true && { vendorReply: { not: null } }),
    ...(hasReply === false && { vendorReply: null }),
  };

  const orderBy = sort === "lowest" ? { rating: "asc" as const } : { createdAt: "desc" as const };

  const [reviews, total, unanswered] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy,
      take,
      skip,
      include: {
        user: { select: { firstName: true, lastName: true } },
        facility: { select: { id: true, name: true } },
        booking: { include: { slot: { select: { date: true } } } },
      },
    }),
    prisma.review.count({ where }),
    prisma.review.count({ where: { ...where, vendorReply: null } }),
  ]);

  return { reviews, total, unanswered, page: Math.max(page, 1), limit: take, hasMore: skip + take < total };
}

// ─── Admin: get all reviews ───────────────────────────────────────────────────

export async function getAllReviews(options: {
  page?: number;
  limit?: number;
  flagged?: boolean;
  rating?: number;
} = {}) {
  const { page = 1, limit = 20, flagged, rating } = options;
  const take = Math.min(limit, 100);
  const skip = (Math.max(page, 1) - 1) * take;

  const where = {
    ...(flagged === true && { flaggedAt: { not: null } }),
    ...(rating !== undefined && { rating }),
  };

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: {
        user: { select: { firstName: true, lastName: true } },
        facility: { select: { id: true, name: true } },
      },
    }),
    prisma.review.count({ where }),
  ]);

  return { reviews, total, page: Math.max(page, 1), limit: take, hasMore: skip + take < total };
}

// ─── Admin: toggle visibility ─────────────────────────────────────────────────

export async function setReviewVisibility(reviewId: string, isVisible: boolean) {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw appError("Review not found", 404);
  return prisma.review.update({ where: { id: reviewId }, data: { isVisible, flaggedAt: null, flagReason: null } });
}
