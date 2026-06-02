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

  // ── Teardown (leaf → root to satisfy FK constraints) ────────────────────────
  console.log("  🗑   Clearing existing data…");

  await prisma.chatMessage.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.openGameParticipant.deleteMany();
  await prisma.openGame.deleteMany();
  await prisma.review.deleteMany();
  await prisma.domeCredit.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.slot.deleteMany();
  await prisma.court.deleteMany();
  await prisma.operatingHours.deleteMany();
  await prisma.facilityAmenityLink.deleteMany();
  await prisma.facilityAddress.deleteMany();
  await prisma.facility.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  console.log("  ✔  All tables cleared\n");

  // ── 1. Vendor user ──────────────────────────────────────────────────────────
  const vendorUser = await prisma.user.create({
    data: {
      phone: "+14165550100",
      firstName: "Alex",
      lastName: "Morgan",
      role: UserRole.VENDOR,
      province: Province.ON,
      isPhoneVerified: true,
    },
  });
  console.log(`  ✔  Vendor user     ${vendorUser.id}`);

  // ── 2. Vendor record ────────────────────────────────────────────────────────
  const vendor = await prisma.vendor.create({
    data: {
      userId: vendorUser.id,
      businessName: "Daflo Sports Inc",
      province: Province.ON,
      status: VendorStatus.APPROVED,
      stripeOnboardingComplete: false,
    },
  });
  console.log(`  ✔  Vendor          ${vendor.id}`);

  // ── 3. Player user ──────────────────────────────────────────────────────────
  const playerUser = await prisma.user.create({
    data: {
      phone: "+14165550101",
      firstName: "Sam",
      lastName: "Park",
      role: UserRole.PLAYER,
      province: Province.ON,
      isPhoneVerified: true,
    },
  });
  console.log(`  ✔  Player user     ${playerUser.id}`);

  // ── 4. Facility ─────────────────────────────────────────────────────────────
  const facility = await prisma.facility.create({
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
          lat: 43.6532,
          lng: -79.3832,
        },
      },
      operatingHours: {
        createMany: {
          data: [
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
  console.log(`  ✔  Facility        ${facility.id}`);

  // ── 5. Court ─────────────────────────────────────────────────────────────────
  const court = await prisma.court.create({
    data: {
      facilityId: facility.id,
      name: "Court 1",
      description: "Full-size badminton court with BWF-standard sprung hardwood flooring",
      isActive: true,
    },
  });
  console.log(`  ✔  Court           ${court.id}`);

  // ── 6. Slots — next 7 days, 09:00–21:00, 60-min blocks, C$25 ────────────────
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
  console.log(`  ✔  Slots           ${count} created  (7 days × 12 slots)`);

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log(`
┌─────────────────────────────────────────────────────────────────────┐
│  Seed complete                                                      │
├──────────────────┬──────────────────────────────────────────────────┤
│  Vendor user     │  ${vendorUser.id.padEnd(36)}   │
│  Vendor          │  ${vendor.id.padEnd(36)}   │
│  Player user     │  ${playerUser.id.padEnd(36)}   │
│  Facility        │  ${facility.id.padEnd(36)}   │
│  Court           │  ${court.id.padEnd(36)}   │
├──────────────────┴──────────────────────────────────────────────────┤
│  Phones   vendor +14165550100  ·  player +14165550101              │
│  Address  123 Sport Way, Toronto ON  (43.6532, -79.3832)           │
│  Slots    ${String(count).padEnd(3)} ×  C$25  09:00–21:00  next 7 days            │
└─────────────────────────────────────────────────────────────────────┘
`);
}

main()
  .catch((err) => {
    console.error("\n❌  Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
