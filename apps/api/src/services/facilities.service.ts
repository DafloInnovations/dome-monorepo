import {
  type Prisma,
  Province,
  SlotStatus,
  SportType,
  SurfaceType,
} from "@prisma/client";
import { calculatePricingForCourt } from "./pricing.service";
import { prisma } from "../lib/prisma";

// ─── Geo helpers ─────────────────────────────────────────────────────────────

const EARTH_KM = 6371;

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return EARTH_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function boundingBox(lat: number, lng: number, radiusKm: number) {
  const latΔ = (radiusKm / EARTH_KM) * (180 / Math.PI);
  const lngΔ =
    (radiusKm / (EARTH_KM * Math.cos(toRad(lat)))) * (180 / Math.PI);
  return {
    latMin: lat - latΔ,
    latMax: lat + latΔ,
    lngMin: lng - lngΔ,
    lngMax: lng + lngΔ,
  };
}

// ─── Enum coercion helpers ────────────────────────────────────────────────────

function coerceSport(s: string): SportType {
  const v = s.toUpperCase() as SportType;
  if (!Object.values(SportType).includes(v))
    throw appError(`Invalid sport: ${s}`, 400);
  return v;
}

function coerceSurface(s: string): SurfaceType {
  const v = s.toUpperCase() as SurfaceType;
  if (!Object.values(SurfaceType).includes(v))
    throw appError(`Invalid surface: ${s}`, 400);
  return v;
}

function coerceProvince(s: string): Province {
  const v = s.toUpperCase() as Province;
  if (!Object.values(Province).includes(v))
    throw appError(`Invalid province: ${s}`, 400);
  return v;
}

function appError(msg: string, status = 500, code?: string) {
  return Object.assign(new Error(msg), { status, code });
}

// Parse "YYYY-MM-DD" → UTC midnight Date (safe for @db.Date columns)
function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

// ─── Shared Prisma include shape ──────────────────────────────────────────────

const facilityListInclude = {
  address: true,
  amenities: { include: { amenity: true } },
  _count: { select: { reviews: true } },
} satisfies Prisma.FacilityInclude;

const facilityDetailInclude = {
  address: true,
  amenities: { include: { amenity: true } },
  courts: { orderBy: { createdAt: "asc" as const } },
  operatingHours: { orderBy: { day: "asc" as const } },
  vendor: {
    select: {
      id: true,
      businessName: true,
      logoUrl: true,
      website: true,
      province: true,
    },
  },
  _count: { select: { reviews: true } },
} satisfies Prisma.FacilityInclude;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ListFacilitiesParams {
  sport?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  date?: string;
  city?: string;
  province?: string;
  page?: number;
  limit?: number;
  sort?: "distance" | "rating" | "price";
}

export interface CreateFacilityInput {
  description: string;
  sport: string;
  surface: string;
  capacity: number;
  images?: string[];
  address: {
    street: string;
    city: string;
    province: string;
    postalCode: string;
    lat?: number | null;
    lng?: number | null;
  };
  operatingHours?: Array<{
    day: number;
    openTime: string;
    closeTime: string;
    isClosed?: boolean;
  }>;
}

export type UpdateFacilityInput = Partial<CreateFacilityInput> & {
  isActive?: boolean;
  cancellationWindowHours?: number;
};

// ─── List facilities ──────────────────────────────────────────────────────────

export async function listFacilities(params: ListFacilitiesParams) {
  const {
    sport,
    lat,
    lng,
    radiusKm = 25,
    date,
    city,
    province,
    page = 1,
    limit = 20,
    sort,
  } = params;

  const geoSearch = lat !== undefined && lng !== undefined;

  // Build address sub-filter
  const addressFilter: Prisma.FacilityAddressWhereInput = {};
  if (city) addressFilter.city = { contains: city, mode: "insensitive" };
  if (province) addressFilter.province = coerceProvince(province);
  if (geoSearch) {
    const bb = boundingBox(lat!, lng!, radiusKm);
    // Require lat/lng to be non-null and within the bounding box.
    // Facilities without coordinates are excluded from geo results.
    addressFilter.lat = { not: null, gte: bb.latMin, lte: bb.latMax };
    addressFilter.lng = { not: null, gte: bb.lngMin, lte: bb.lngMax };
  }

  const where: Prisma.FacilityWhereInput = {
    isActive: true,
    ...(sport && { sport: coerceSport(sport) }),
    // `is:` ensures we only match facilities that have an address record
    // satisfying every condition in addressFilter (not facilities with no address).
    ...(Object.keys(addressFilter).length > 0 && {
      address: { is: addressFilter },
    }),
    ...(date && {
      slots: { some: { date: parseDate(date), status: SlotStatus.AVAILABLE } },
    }),
  };

  // Geo: over-fetch within bounding box, then post-filter by exact distance
  const pageSize = Math.min(limit, 50);
  const fetchLimit = geoSearch ? 200 : pageSize;
  const fetchSkip = geoSearch ? 0 : (page - 1) * pageSize;

  const [rawFacilities, total] = await Promise.all([
    prisma.facility.findMany({
      where,
      include: facilityListInclude,
      take: fetchLimit,
      skip: fetchSkip,
      orderBy: { createdAt: "desc" },
    }),
    geoSearch ? Promise.resolve(0) : prisma.facility.count({ where }),
  ]);

  // Batch-fetch rating aggregates in one query
  const ids = rawFacilities.map((f) => f.id);
  const ratings = await prisma.review.groupBy({
    by: ["facilityId"],
    where: { facilityId: { in: ids } },
    _avg: { rating: true },
    _count: { id: true },
  });
  const ratingMap = new Map(ratings.map((r) => [r.facilityId, r]));

  // Attach ratings + optional distance
  type FacilityRow = (typeof rawFacilities)[number];
  let results = rawFacilities.map((f: FacilityRow) => ({
    ...f,
    averageRating: ratingMap.get(f.id)?._avg.rating ?? null,
    totalReviews: ratingMap.get(f.id)?._count.id ?? 0,
    distanceKm:
      geoSearch && f.address?.lat != null && f.address?.lng != null
        ? haversineKm(lat!, lng!, f.address.lat, f.address.lng)
        : undefined,
  }));

  // Post-filter and sort
  if (geoSearch) {
    results = results.filter((f) => f.distanceKm !== undefined && f.distanceKm <= radiusKm);
  }

  if (sort === "rating") {
    results = results.sort((a, b) => {
      const rA = a.averageRating ?? 0;
      const rB = b.averageRating ?? 0;
      if (rB !== rA) return rB - rA;
      return (b.totalReviews ?? 0) - (a.totalReviews ?? 0);
    });
  } else if (geoSearch) {
    results = results.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  }

  const paged = geoSearch
    ? results.slice((page - 1) * pageSize, page * pageSize)
    : results;

  const effectiveTotal = geoSearch ? results.length : total;

  return {
    data: paged,
    total: effectiveTotal,
    page,
    limit: pageSize,
    hasMore: page * pageSize < effectiveTotal,
  };
}

// ─── Get facility detail ──────────────────────────────────────────────────────

export async function getFacility(id: string) {
  const facility = await prisma.facility.findFirst({
    where: { id, isActive: true },
    include: facilityDetailInclude,
  });

  if (!facility) throw appError("Facility not found", 404);

  // Rating summary
  const [agg, distribution] = await Promise.all([
    prisma.review.aggregate({
      where: { facilityId: id },
      _avg: { rating: true },
      _count: { id: true },
    }),
    prisma.review.groupBy({
      by: ["rating"],
      where: { facilityId: id },
      _count: { id: true },
    }),
  ]);

  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of distribution) dist[row.rating] = row._count.id;

  return {
    ...facility,
    averageRating:
      agg._avg.rating !== null
        ? Math.round(agg._avg.rating * 10) / 10
        : null,
    totalReviews: agg._count.id,
    ratingDistribution: dist,
  };
}

// ─── Get slots for a facility on a date ──────────────────────────────────────

export async function getFacilitySlots(facilityId: string, date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw appError("date must be YYYY-MM-DD", 400);

  const facility = await prisma.facility.findFirst({
    where: { id: facilityId, isActive: true },
    select: { id: true },
  });
  if (!facility) throw appError("Facility not found", 404);

  const slots = await prisma.slot.findMany({
    where: {
      facilityId,
      date: parseDate(date),
      status: SlotStatus.AVAILABLE,
    },
    orderBy: { startTime: "asc" },
    select: {
      id: true,
      startTime: true,
      endTime: true,
      durationMinutes: true,
      priceCAD: true,
      status: true,
    },
  });

  return {
    facilityId,
    date,
    slots: slots.map((s) => ({
      ...s,
      priceCAD: Number(s.priceCAD),
    })),
  };
}

// ─── Create facility (vendor) ─────────────────────────────────────────────────

export async function createFacility(userId: string, input: CreateFacilityInput) {
  const vendor = await prisma.vendor.findUnique({ where: { userId } });
  if (!vendor) throw appError("Vendor profile not found. Apply to become a vendor first.", 403);

  const { address, operatingHours = [], ...rest } = input;

  const facility = await prisma.facility.create({
    data: {
      vendorId: vendor.id,
      name: vendor.businessName,
      description: rest.description,
      sport: coerceSport(rest.sport),
      surface: coerceSurface(rest.surface),
      capacity: rest.capacity,
      images: rest.images ?? [],
      address: {
        create: {
          street: address.street,
          city: address.city,
          province: coerceProvince(address.province),
          postalCode: address.postalCode.replace(/\s/g, "").toUpperCase(),
          country: "CA",
          // typeof guards ensure 0 (equator / prime meridian) is stored correctly
          // and that undefined/null inputs result in a stored NULL.
          lat: typeof address.lat === "number" ? address.lat : null,
          lng: typeof address.lng === "number" ? address.lng : null,
        },
      },
      ...(operatingHours.length > 0 && {
        operatingHours: {
          createMany: {
            data: operatingHours.map((h) => ({
              day: h.day,
              openTime: h.openTime,
              closeTime: h.closeTime,
              isClosed: h.isClosed ?? false,
            })),
          },
        },
      }),
    },
    include: facilityDetailInclude,
  });

  return facility;
}

// ─── Update facility (vendor) ─────────────────────────────────────────────────

export async function updateFacility(
  userId: string,
  facilityId: string,
  input: UpdateFacilityInput
) {
  // Verify ownership
  const existing = await prisma.facility.findFirst({
    where: { id: facilityId, vendor: { userId } },
    include: { address: true },
  });
  if (!existing) throw appError("Facility not found", 404);

  const { address, operatingHours, images, isActive, cancellationWindowHours, ...rest } = input;

  const updated = await prisma.facility.update({
    where: { id: facilityId },
    data: {
      ...(rest.description && { description: rest.description }),
      ...(rest.sport && { sport: coerceSport(rest.sport) }),
      ...(rest.surface && { surface: coerceSurface(rest.surface) }),
      ...(rest.capacity && { capacity: rest.capacity }),
      ...(images && { images }),
      ...(isActive !== undefined && { isActive }),
      ...(cancellationWindowHours !== undefined && { cancellationWindowHours }),
      ...(address && {
        address: {
          upsert: {
            create: {
              street: address.street ?? "",
              city: address.city ?? "",
              province: coerceProvince(address.province ?? "ON"),
              postalCode: (address.postalCode ?? "").replace(/\s/g, "").toUpperCase(),
              country: "CA",
              lat: typeof address.lat === "number" ? address.lat : null,
              lng: typeof address.lng === "number" ? address.lng : null,
            },
            update: {
              // Use explicit checks so empty strings update, and 0 lat/lng update.
              // `!== undefined` distinguishes "not provided" from "explicitly null" (clear).
              ...(address.street !== undefined && { street: address.street }),
              ...(address.city !== undefined && { city: address.city }),
              ...(address.province !== undefined && {
                province: coerceProvince(address.province),
              }),
              ...(address.postalCode !== undefined && {
                postalCode: address.postalCode.replace(/\s/g, "").toUpperCase(),
              }),
              ...(address.lat !== undefined && {
                lat: typeof address.lat === "number" ? address.lat : null,
              }),
              ...(address.lng !== undefined && {
                lng: typeof address.lng === "number" ? address.lng : null,
              }),
            },
          },
        },
      }),
      ...(operatingHours && {
        operatingHours: {
          deleteMany: {},
          createMany: {
            data: operatingHours.map((h) => ({
              day: h.day,
              openTime: h.openTime,
              closeTime: h.closeTime,
              isClosed: h.isClosed ?? false,
            })),
          },
        },
      }),
    },
    include: facilityDetailInclude,
  });

  return updated;
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

function addMins(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h! * 60 + m! + mins;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// ─── Available courts for a time window ──────────────────────────────────────

export async function getAvailableCourts(
  facilityId: string,
  date: string,
  startTime: string,
  durationMinutes: number,
  sport?: string
) {
  const endTime = addMins(startTime, durationMinutes);

  const facility = await prisma.facility.findFirst({
    where: { id: facilityId, isActive: true },
    include: {
      courts: {
        where: { isActive: true },
        include: { sportPricing: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!facility) throw appError("Facility not found", 404);

  const parsedDate = parseDate(date);
  const requestedSport = sport?.toUpperCase() ?? null;

  type CourtEntry = {
    id: string;
    name: string;
    unitType: string;
    unitLabel: string;
    sport: string;
    surface: string;
    isShared: boolean;
    sports: string[];
    primarySport: string | null;
    requestedSport: string | null;
    totalPriceCAD: number;
    basePriceCAD: number;
    priceBreakdown: { basePriceCAD: number; appliedRule: string | null; finalPriceCAD: number } | null;
    isAvailable: boolean;
    notCovered: boolean;
    slots: string[];
    bookedUntil: string | null;
    unavailableReason: string | null;
  };

  const courtEntries: CourtEntry[] = [];

  for (const court of facility.courts) {
    if (court.isShared && court.sports.length > 0) {
      // Shared court — emit one entry per sport (filtered by requestedSport if given)
      const sportsToShow = requestedSport
        ? court.sports.includes(requestedSport) ? [requestedSport] : []
        : court.sports;

      for (const sportName of sportsToShow) {
        // Fetch slots for this specific sport
        const slots = await prisma.slot.findMany({
          where: {
            courtId: court.id,
            date: parsedDate,
            startTime: { gte: startTime },
            endTime: { lte: endTime },
            sport: sportName,
          },
          orderBy: { startTime: "asc" },
          select: {
            id: true, startTime: true, endTime: true,
            priceCAD: true, status: true, blockReason: true,
          },
        });

        let cursor = startTime;
        let isFullyCovered = slots.length > 0;
        for (const slot of slots) {
          if (slot.startTime !== cursor) { isFullyCovered = false; break; }
          cursor = slot.endTime;
        }
        if (cursor !== endTime) isFullyCovered = false;

        const allAvailable = isFullyCovered && slots.every((s) => s.status === SlotStatus.AVAILABLE);
        const blockedSlot = slots.find((s) => s.status !== SlotStatus.AVAILABLE);
        const unavailableReason = blockedSlot?.blockReason ?? null;

        // Use sport-specific pricing or fall back to slot price
        const sportPriceRow = court.sportPricing.find((p) => p.sport === sportName);
        const pricingResults = await calculatePricingForCourt(
          court.id,
          parsedDate,
          slots.map((s) => ({
            startTime: s.startTime,
            endTime: s.endTime,
            basePriceCAD: sportPriceRow ? Number(sportPriceRow.priceCAD) : Number(s.priceCAD),
          }))
        );

        const totalPriceCAD = Math.round(
          pricingResults.reduce((sum, p) => sum + p.finalPriceCAD, 0) * 100
        ) / 100;
        const baseTotalCAD = Math.round(
          pricingResults.reduce((sum, p) => sum + p.basePriceCAD, 0) * 100
        ) / 100;
        const firstBreakdown = pricingResults[0];

        courtEntries.push({
          id: court.id,
          name: court.name,
          unitType: court.unitType,
          unitLabel: court.unitLabel,
          sport: sportName,
          surface: facility.surface as string,
          isShared: true,
          sports: court.sports,
          primarySport: court.primarySport,
          requestedSport: sportName,
          totalPriceCAD,
          basePriceCAD: baseTotalCAD,
          priceBreakdown: firstBreakdown
            ? { basePriceCAD: firstBreakdown.basePriceCAD, appliedRule: firstBreakdown.appliedRule, finalPriceCAD: firstBreakdown.finalPriceCAD }
            : null,
          isAvailable: allAvailable,
          notCovered: !isFullyCovered,
          slots: allAvailable ? slots.map((s) => s.id) : [],
          bookedUntil: !allAvailable && blockedSlot ? blockedSlot.endTime : null,
          unavailableReason,
        });
      }
    } else {
      // Non-shared court — standard single-sport logic
      const slots = await prisma.slot.findMany({
        where: {
          courtId: court.id,
          date: parsedDate,
          startTime: { gte: startTime },
          endTime: { lte: endTime },
        },
        orderBy: { startTime: "asc" },
        select: {
          id: true, startTime: true, endTime: true,
          priceCAD: true, status: true, blockReason: true,
        },
      });

      let cursor = startTime;
      let isFullyCovered = slots.length > 0;
      for (const slot of slots) {
        if (slot.startTime !== cursor) { isFullyCovered = false; break; }
        cursor = slot.endTime;
      }
      if (cursor !== endTime) isFullyCovered = false;

      const allAvailable = isFullyCovered && slots.every((s) => s.status === SlotStatus.AVAILABLE);
      const blockedSlot = slots.find((s) => s.status !== SlotStatus.AVAILABLE);

      const pricingResults = await calculatePricingForCourt(
        court.id,
        parsedDate,
        slots.map((s) => ({
          startTime: s.startTime,
          endTime: s.endTime,
          basePriceCAD: Number(s.priceCAD),
        }))
      );

      const totalPriceCAD = Math.round(
        pricingResults.reduce((sum, p) => sum + p.finalPriceCAD, 0) * 100
      ) / 100;
      const baseTotalCAD = Math.round(
        pricingResults.reduce((sum, p) => sum + p.basePriceCAD, 0) * 100
      ) / 100;
      const firstBreakdown = pricingResults[0];

      // Filter by requested sport if provided
      const courtSport = (facility.sport as string).toUpperCase();
      if (requestedSport && courtSport !== requestedSport) continue;

      courtEntries.push({
        id: court.id,
        name: court.name,
        unitType: court.unitType,
        unitLabel: court.unitLabel,
        sport: facility.sport as string,
        surface: facility.surface as string,
        isShared: false,
        sports: [facility.sport as string],
        primarySport: facility.sport as string,
        requestedSport: requestedSport,
        totalPriceCAD,
        basePriceCAD: baseTotalCAD,
        priceBreakdown: firstBreakdown
          ? { basePriceCAD: firstBreakdown.basePriceCAD, appliedRule: firstBreakdown.appliedRule, finalPriceCAD: firstBreakdown.finalPriceCAD }
          : null,
        isAvailable: allAvailable,
        notCovered: !isFullyCovered,
        slots: allAvailable ? slots.map((s) => s.id) : [],
        bookedUntil: !allAvailable && blockedSlot ? blockedSlot.endTime : null,
        unavailableReason: blockedSlot?.blockReason ?? null,
      });
    }
  }

  return {
    date,
    startTime,
    endTime,
    durationMinutes,
    courts: courtEntries,
  };
}
