import { BookingStatus, type Province } from "@prisma/client";
import { calculateTax } from "@dome/utils";
import { prisma } from "../lib/prisma";
import { stripe } from "../lib/stripe";

function appError(msg: string, status = 400, code?: string) {
  return Object.assign(new Error(msg), { status, code });
}

// ─── Get facility equipment ───────────────────────────────────────────────────

export async function getFacilityEquipment(facilityId: string, sport?: string) {
  const equipment = await prisma.equipment.findMany({
    where: {
      facilityId,
      isActive: true,
      ...(sport ? { sport: sport.toUpperCase() } : {}),
    },
    orderBy: [{ sport: "asc" }, { priceCAD: "asc" }],
  });

  // For each item, compute how many units are already rented today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const rentedCounts = await prisma.equipmentRental.groupBy({
    by: ["equipmentId"],
    where: {
      equipmentId: { in: equipment.map((e) => e.id) },
      booking: {
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
        createdAt: { gte: today, lt: tomorrow },
      },
    },
    _sum: { quantity: true },
  });

  const rentedMap = new Map(rentedCounts.map((r) => [r.equipmentId, r._sum.quantity ?? 0]));

  return equipment.map((e) => ({
    ...e,
    priceCAD: Number(e.priceCAD),
    availableQuantity: Math.max(0, e.quantity - (rentedMap.get(e.id) ?? 0)),
  }));
}

// ─── Check availability for a date ───────────────────────────────────────────

export async function checkEquipmentAvailability(
  equipmentId: string,
  date: Date,
  requestedQty: number
): Promise<number> {
  const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId } });
  if (!equipment || !equipment.isActive) return 0;

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const rented = await prisma.equipmentRental.aggregate({
    where: {
      equipmentId,
      booking: {
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
        createdAt: { gte: dayStart, lt: dayEnd },
      },
    },
    _sum: { quantity: true },
  });

  return Math.max(0, equipment.quantity - (rented._sum.quantity ?? 0));
}

// ─── Add equipment to a pending booking ──────────────────────────────────────

export async function addEquipmentToBooking(
  userId: string,
  bookingId: string,
  items: Array<{ equipmentId: string; quantity: number }>
) {
  if (!items.length) throw appError("No items provided", 400);

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId, status: BookingStatus.PENDING },
    include: { slot: true, equipmentRentals: true },
  });
  if (!booking) throw appError("Booking not found or not in PENDING state", 404);
  if (!booking.paymentIntentId) throw appError("Booking has no associated payment intent", 400);

  // Validate & price each item
  const equipmentIds = items.map((i) => i.equipmentId);
  const equipmentList = await prisma.equipment.findMany({
    where: { id: { in: equipmentIds }, facilityId: booking.facilityId, isActive: true },
  });
  if (equipmentList.length !== equipmentIds.length) {
    throw appError("One or more equipment items not found or unavailable", 404);
  }

  // Availability check per item
  const slotDate = booking.slot.date instanceof Date ? booking.slot.date : new Date(booking.slot.date);
  for (const item of items) {
    const available = await checkEquipmentAvailability(item.equipmentId, slotDate, item.quantity);
    if (available < item.quantity) {
      const eq = equipmentList.find((e) => e.id === item.equipmentId)!;
      throw appError(
        `Only ${available} unit(s) of "${eq.name}" available`,
        409,
        "EQUIPMENT_UNAVAILABLE"
      );
    }
  }

  // Remove existing rentals for this booking (replace-all pattern)
  await prisma.equipmentRental.deleteMany({ where: { bookingId } });

  // Create new rentals
  const rentals = await prisma.$transaction(
    items.map((item) => {
      const eq = equipmentList.find((e) => e.id === item.equipmentId)!;
      return prisma.equipmentRental.create({
        data: {
          bookingId,
          equipmentId: item.equipmentId,
          quantity: item.quantity,
          priceCAD: Number(eq.priceCAD) * item.quantity,
        },
      });
    })
  );

  // Recalculate totals
  const equipmentTotalCAD = rentals.reduce((s, r) => s + Number(r.priceCAD), 0);
  const courtSubtotal = Number(booking.subtotalCAD) - (Number(booking.equipmentTotalCAD) ?? 0);
  const newSubtotal = Math.round((courtSubtotal + equipmentTotalCAD) * 100) / 100;
  const newTax = calculateTax(newSubtotal, booking.taxProvince as Province);
  const newTotal = Math.round((newSubtotal + newTax) * 100) / 100;

  // Update booking financials
  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      equipmentTotalCAD,
      subtotalCAD: newSubtotal,
      taxCAD: newTax,
      totalCAD: newTotal,
    },
  });

  // Update Stripe PaymentIntent amount
  await stripe.paymentIntents.update(booking.paymentIntentId, {
    amount: Math.round(newTotal * 100),
    metadata: { equipmentTotalCAD: String(equipmentTotalCAD) },
  });

  return {
    rentals: rentals.map((r) => ({ ...r, priceCAD: Number(r.priceCAD) })),
    equipmentTotalCAD,
    subtotalCAD: newSubtotal,
    taxCAD: newTax,
    totalCAD: newTotal,
  };
}

// ─── Remove a rental from a pending booking ───────────────────────────────────

export async function removeEquipmentFromBooking(
  userId: string,
  bookingId: string,
  rentalId: string
) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId, status: BookingStatus.PENDING },
    include: { equipmentRentals: true },
  });
  if (!booking) throw appError("Booking not found or not in PENDING state", 404);
  if (!booking.paymentIntentId) throw appError("Booking has no associated payment intent", 400);

  const rental = booking.equipmentRentals.find((r) => r.id === rentalId);
  if (!rental) throw appError("Rental not found", 404);

  await prisma.equipmentRental.delete({ where: { id: rentalId } });

  // Recalculate
  const remaining = booking.equipmentRentals.filter((r) => r.id !== rentalId);
  const equipmentTotalCAD = remaining.reduce((s, r) => s + Number(r.priceCAD), 0);
  const courtSubtotal = Number(booking.subtotalCAD) - (Number(booking.equipmentTotalCAD) ?? 0);
  const newSubtotal = Math.round((courtSubtotal + equipmentTotalCAD) * 100) / 100;
  const newTax = calculateTax(newSubtotal, booking.taxProvince as Province);
  const newTotal = Math.round((newSubtotal + newTax) * 100) / 100;

  await prisma.booking.update({
    where: { id: bookingId },
    data: { equipmentTotalCAD, subtotalCAD: newSubtotal, taxCAD: newTax, totalCAD: newTotal },
  });

  await stripe.paymentIntents.update(booking.paymentIntentId, {
    amount: Math.round(newTotal * 100),
  });

  return { equipmentTotalCAD, subtotalCAD: newSubtotal, taxCAD: newTax, totalCAD: newTotal };
}

// ─── Vendor: CRUD ─────────────────────────────────────────────────────────────

export async function getVendorEquipment(vendorUserId: string) {
  const facilities = await prisma.facility.findMany({
    where: { vendor: { userId: vendorUserId } },
    select: { id: true, name: true, sport: true },
  });
  const facilityIds = facilities.map((f) => f.id);

  const equipment = await prisma.equipment.findMany({
    where: { facilityId: { in: facilityIds } },
    include: {
      facility: { select: { id: true, name: true } },
      _count: { select: { rentals: true } },
    },
    orderBy: [{ facilityId: "asc" }, { sport: "asc" }],
  });

  return equipment.map((e) => ({ ...e, priceCAD: Number(e.priceCAD) }));
}

export async function createEquipment(
  vendorUserId: string,
  facilityId: string,
  data: {
    name: string;
    description?: string;
    sport: string;
    priceCAD: number;
    quantity: number;
    imageUrl?: string;
  }
) {
  // Verify facility belongs to vendor
  const facility = await prisma.facility.findFirst({
    where: { id: facilityId, vendor: { userId: vendorUserId } },
  });
  if (!facility) throw appError("Facility not found", 404);

  return prisma.equipment.create({
    data: {
      facilityId,
      name: data.name,
      description: data.description ?? null,
      sport: data.sport.toUpperCase(),
      priceCAD: data.priceCAD,
      quantity: data.quantity,
      imageUrl: data.imageUrl ?? null,
    },
  });
}

export async function updateEquipment(
  vendorUserId: string,
  equipmentId: string,
  data: Partial<{
    name: string;
    description: string | null;
    sport: string;
    priceCAD: number;
    quantity: number;
    isActive: boolean;
    imageUrl: string | null;
  }>
) {
  const equipment = await prisma.equipment.findFirst({
    where: { id: equipmentId, facility: { vendor: { userId: vendorUserId } } },
  });
  if (!equipment) throw appError("Equipment not found", 404);

  return prisma.equipment.update({
    where: { id: equipmentId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.sport !== undefined && { sport: data.sport.toUpperCase() }),
      ...(data.priceCAD !== undefined && { priceCAD: data.priceCAD }),
      ...(data.quantity !== undefined && { quantity: data.quantity }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
    },
  });
}

export async function deleteEquipment(vendorUserId: string, equipmentId: string) {
  const equipment = await prisma.equipment.findFirst({
    where: { id: equipmentId, facility: { vendor: { userId: vendorUserId } } },
  });
  if (!equipment) throw appError("Equipment not found", 404);
  return prisma.equipment.update({ where: { id: equipmentId }, data: { isActive: false } });
}

export async function getEquipmentRentalHistory(vendorUserId: string, equipmentId: string) {
  const equipment = await prisma.equipment.findFirst({
    where: { id: equipmentId, facility: { vendor: { userId: vendorUserId } } },
    select: { id: true, name: true, priceCAD: true },
  });
  if (!equipment) throw appError("Equipment not found", 404);

  const rentals = await prisma.equipmentRental.findMany({
    where: { equipmentId },
    include: {
      booking: {
        select: {
          id: true,
          status: true,
          createdAt: true,
          slot: { select: { date: true, startTime: true, endTime: true } },
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const totalRevenue = rentals.reduce((s, r) => s + Number(r.priceCAD), 0);
  return {
    equipment: { ...equipment, priceCAD: Number(equipment.priceCAD) },
    rentals: rentals.map((r) => ({ ...r, priceCAD: Number(r.priceCAD) })),
    totalRevenue,
    totalRentals: rentals.length,
  };
}
