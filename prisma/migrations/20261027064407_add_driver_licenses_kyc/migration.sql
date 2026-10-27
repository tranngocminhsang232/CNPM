-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('NONE', 'PENDING', 'VERIFIED', 'REJECTED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "kyc_status" "KycStatus" NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE "driver_licenses" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "license_number" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "date_of_birth" DATE NOT NULL,
    "license_class" TEXT NOT NULL,
    "expiry_date" DATE NOT NULL,
    "status" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "verified_at" TIMESTAMPTZ(6),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "driver_licenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "driver_licenses_user_id_key" ON "driver_licenses"("user_id");

-- AddForeignKey
ALTER TABLE "driver_licenses" ADD CONSTRAINT "driver_licenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Business Check Constraints for Driver Licenses
ALTER TABLE "driver_licenses"
    ADD CONSTRAINT "driver_licenses_license_number_format_check" CHECK (length(license_number) = 12),
    ADD CONSTRAINT "driver_licenses_expiry_after_dob_check" CHECK (expiry_date > date_of_birth),
    ADD CONSTRAINT "driver_licenses_verified_at_check" CHECK (verified_at IS NULL OR status = 'VERIFIED');

