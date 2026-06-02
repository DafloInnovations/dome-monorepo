-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "businessEmail" TEXT,
ADD COLUMN     "businessPhone" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "sports" TEXT[],
ADD COLUMN     "streetAddress" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ALTER COLUMN "province" SET DEFAULT 'ON';
