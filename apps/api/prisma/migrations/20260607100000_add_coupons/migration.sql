-- CreateEnum
CREATE TYPE "CouponType" AS ENUM ('PERCENTAGE', 'FIXED', 'FREE');

-- AlterTable: add coupon fields to Booking
ALTER TABLE "Booking" ADD COLUMN "couponId"    TEXT;
ALTER TABLE "Booking" ADD COLUMN "couponCode"  TEXT;
ALTER TABLE "Booking" ADD COLUMN "discountCAD" DECIMAL(10,2);

-- CreateTable: Coupon
CREATE TABLE "Coupon" (
    "id"                TEXT NOT NULL,
    "code"              TEXT NOT NULL,
    "description"       TEXT,
    "type"              "CouponType" NOT NULL,
    "value"             DECIMAL(10,2) NOT NULL,
    "vendorId"          TEXT,
    "facilityId"        TEXT,
    "sport"             TEXT,
    "minBookingCAD"     DECIMAL(10,2),
    "maxDiscountCAD"    DECIMAL(10,2),
    "usageLimit"        INTEGER,
    "usageLimitPerUser" INTEGER DEFAULT 1,
    "usedCount"         INTEGER NOT NULL DEFAULT 0,
    "validFrom"         TIMESTAMP(3) NOT NULL,
    "validUntil"        TIMESTAMP(3) NOT NULL,
    "isActive"          BOOLEAN NOT NULL DEFAULT true,
    "createdBy"         TEXT NOT NULL,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CouponUsage
CREATE TABLE "CouponUsage" (
    "id"          TEXT NOT NULL,
    "couponId"    TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "bookingId"   TEXT NOT NULL,
    "discountCAD" DECIMAL(10,2) NOT NULL,
    "appliedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");
CREATE INDEX "Coupon_code_idx" ON "Coupon"("code");
CREATE INDEX "Coupon_vendorId_isActive_idx" ON "Coupon"("vendorId", "isActive");
CREATE INDEX "Coupon_isActive_validUntil_idx" ON "Coupon"("isActive", "validUntil");

CREATE UNIQUE INDEX "CouponUsage_bookingId_key" ON "CouponUsage"("bookingId");
CREATE INDEX "CouponUsage_couponId_idx" ON "CouponUsage"("couponId");
CREATE INDEX "CouponUsage_userId_idx" ON "CouponUsage"("userId");

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_facilityId_fkey"
  FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CouponUsage" ADD CONSTRAINT "CouponUsage_couponId_fkey"
  FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CouponUsage" ADD CONSTRAINT "CouponUsage_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CouponUsage" ADD CONSTRAINT "CouponUsage_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
