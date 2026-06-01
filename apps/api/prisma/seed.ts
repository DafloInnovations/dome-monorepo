import {
  PrismaClient,
  Province,
  SlotStatus,
  SportType,
  SurfaceType,
  UserRole,
  VendorStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function utcDate(offsetDays: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🌱  Seeding dome_dev…\n");

  // ── 1. Vendor user ──────────────────────────────────────────────────────────
  const vendorUser = await prisma.user.upsert({
    where: { phone: "+14165550100" },
    update: {},
    create: {
      phone: "+14165550100",
      firstName: "Alex",
      lastName: "Morgan",
      role: UserRole.VENDOR,
      province: Province.ON,
      isPhoneVerified: true,
    },
  });
  console.log(`  ✔  Vendor user     ${vendorUser.id}  (+14165550100)`);

  // ── 2. Vendor record ────────────────────────────────────────────────────────
  // VendorStatus has no ACTIVE — APPROVED is the equivalent approved state.
  const vendor = await prisma.vendor.upsert({
    where: { userId: vendorUser.id },
    update: { status: VendorStatus.APPROVED },
    create: {
      userId: vendorUser.id,
      businessName: "Daflo Sports Inc",
      province: Province.ON,
      status: VendorStatus.APPROVED,
      stripeOnboardingComplete: false,
    },
  });
  console.log(`  ✔  Vendor record   ${vendor.id}  (${vendor.businessName})`);

  // ── 3. Player user ──────────────────────────────────────────────────────────
  const playerUser = await prisma.user.upsert({
    where: { phone: "+14165550101" },
    update: {},
    create: {
      phone: "+14165550101",
      firstName: "Sam",
      lastName: "Park",
      role: UserRole.PLAYER,
      province: Province.ON,
      isPhoneVerified: true,
    },
  });
  console.log(`  ✔  Player user     ${playerUser.id}  (+14165550101)`);

  // ── 4. ProSports Complex facility ───────────────────────────────────────────
  let facility = await prisma.facility.findFirst({
    where: { vendorId: vendor.id, name: "ProSports Complex" },
  });

  if (!facility) {
    facility = await prisma.facility.create({
      data: {
        vendorId: vendor.id,
        name: "ProSports Complex",
        description:
          "A premier multi-sport complex in downtown Toronto featuring " +
          "professional-grade badminton, squash, and racket courts with " +
          "sprung hardwood flooring, changerooms, and pro shop on site.",
        sport: SportType.BADMINTON,
        surface: SurfaceType.HARDWOOD,
        capacity: 20,
        images: [],
        isActive: true,
        address: {
          create: {
            street: "123 Sport Way",
            city: "Toronto",
            province: Province.ON,
            postalCode: "M5V1A1",
            country: "CA",
            lat: 43.651,
            lng: -79.347,
          },
        },
        operatingHours: {
          createMany: {
            data: [
              // Sun – Sat (day 0–6), Mon–Fri 06:00–22:00, Sat–Sun 08:00–20:00
              { day: 0, openTime: "08:00", closeTime: "20:00", isClosed: false },
              { day: 1, openTime: "06:00", closeTime: "22:00", isClosed: false },
              { day: 2, openTime: "06:00", closeTime: "22:00", isClosed: false },
              { day: 3, openTime: "06:00", closeTime: "22:00", isClosed: false },
              { day: 4, openTime: "06:00", closeTime: "22:00", isClosed: false },
              { day: 5, openTime: "06:00", closeTime: "22:00", isClosed: false },
              { day: 6, openTime: "08:00", closeTime: "20:00", isClosed: false },
            ],
          },
        },
      },
    });
    console.log(`  ✔  Facility        ${facility.id}  (ProSports Complex) — created`);
  } else {
    console.log(`  ✔  Facility        ${facility.id}  (ProSports Complex) — already exists`);
  }

  // ── Court 1 ─────────────────────────────────────────────────────────────────
  let court = await prisma.court.findFirst({
    where: { facilityId: facility.id, name: "Court 1" },
  });

  if (!court) {
    court = await prisma.court.create({
      data: {
        facilityId: facility.id,
        name: "Court 1",
        description: "Full-size badminton court with BWF-standard sprung hardwood flooring",
        isActive: true,
      },
    });
    console.log(`  ✔  Court           ${court.id}  (Court 1) — created`);
  } else {
    console.log(`  ✔  Court           ${court.id}  (Court 1) — already exists`);
  }

  // ── 5. Slots for the next 7 days (09:00–21:00, 60-min blocks, $25 CAD) ──────
  const today = utcDate(0);
  const endDate = utcDate(6);

  // Remove any existing AVAILABLE slots for this court in the window
  // so the seed is safe to re-run without duplicates.
  const deleted = await prisma.slot.deleteMany({
    where: {
      courtId: court.id,
      date: { gte: today, lte: endDate },
      status: SlotStatus.AVAILABLE,
    },
  });

  // Build 12 × 60-min blocks per day (09:00 → 21:00)
  const slotRows: {
    facilityId: string;
    courtId: string;
    date: Date;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    priceCAD: number;
    status: SlotStatus;
  }[] = [];

  for (let day = 0; day < 7; day++) {
    const date = utcDate(day);
    for (let hour = 9; hour < 21; hour++) {
      slotRows.push({
        facilityId: facility.id,
        courtId: court.id,
        date,
        startTime: `${pad(hour)}:00`,
        endTime: `${pad(hour + 1)}:00`,
        durationMinutes: 60,
        priceCAD: 25.0,
        status: SlotStatus.AVAILABLE,
      });
    }
  }

  const { count } = await prisma.slot.createMany({ data: slotRows });
  console.log(
    `  ✔  Slots           ${count} created  (${deleted.count} stale removed)`
  );

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log(`
┌────────────────────────────────────────────────────────────────┐
│  Seed complete                                                 │
│                                                                │
│  Vendor   +14165550100  /  Daflo Sports Inc  (APPROVED)       │
│  Player   +14165550101                                         │
│  Facility ProSports Complex — 123 Sport Way, Toronto ON        │
│  Court    Court 1 (badminton, hardwood)                        │
│  Slots    ${String(count).padEnd(4)} ×  $25 CAD  09:00–21:00  next 7 days         │
└────────────────────────────────────────────────────────────────┘
`);
}

main()
  .catch((err) => {
    console.error("\n❌  Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
