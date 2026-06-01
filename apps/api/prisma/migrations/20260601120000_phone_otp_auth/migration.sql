-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isPhoneVerified" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "passwordHash" DROP NOT NULL,
ALTER COLUMN "firstName" SET DEFAULT '',
ALTER COLUMN "lastName" SET DEFAULT '',
ALTER COLUMN "phone" SET NOT NULL,
ALTER COLUMN "province" SET DEFAULT 'ON';

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "User"("phone");
