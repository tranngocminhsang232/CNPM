-- CreateEnum
CREATE TYPE "CarType" AS ENUM ('SEDAN', 'SUV', 'HATCHBACK', 'MPV', 'CROSSOVER');

-- CreateEnum
CREATE TYPE "Transmission" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MediaPurpose" AS ENUM ('VEHICLE_PHOTO', 'INSPECTION_PHOTO', 'IDENTITY_DOCUMENT');

-- CreateEnum
CREATE TYPE "MediaState" AS ENUM ('STAGING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CalendarKind" AS ENUM ('BOOKING', 'OWNER_BLOCK');

-- CreateEnum
CREATE TYPE "InspectionType" AS ENUM ('CHECK_IN', 'CHECK_OUT');

-- CreateEnum
CREATE TYPE "InspectionAngle" AS ENUM ('FRONT', 'REAR', 'LEFT', 'RIGHT');

-- CreateEnum
CREATE TYPE "KeylessAction" AS ENUM ('LOCK', 'UNLOCK');

-- CreateEnum
CREATE TYPE "KeylessOperationStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'UNKNOWN');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email_normalized" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "password_hash" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "subject" TEXT NOT NULL,

    CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "family_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "replaced_by" UUID,

    CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "plate_normalized" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "pickup_address" TEXT NOT NULL,
    "car_type" "CarType" NOT NULL,
    "transmission" "Transmission" NOT NULL,
    "seats" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "price_per_day_vnd" BIGINT NOT NULL,
    "keyless_supported" BOOLEAN NOT NULL DEFAULT false,
    "status" "VehicleStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_amenities" (
    "vehicle_id" UUID NOT NULL,
    "amenity_code" TEXT NOT NULL,

    CONSTRAINT "vehicle_amenities_pkey" PRIMARY KEY ("vehicle_id","amenity_code")
);

-- CreateTable
CREATE TABLE "media_objects" (
    "id" UUID NOT NULL,
    "uploader_id" UUID NOT NULL,
    "purpose" "MediaPurpose" NOT NULL,
    "vehicle_id" UUID,
    "booking_id" UUID,
    "staging_key" TEXT NOT NULL,
    "final_key" TEXT,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "state" "MediaState" NOT NULL DEFAULT 'STAGING',
    "verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_photos" (
    "vehicle_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "vehicle_photos_pkey" PRIMARY KEY ("vehicle_id","media_id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "renter_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "start_at" TIMESTAMPTZ(6) NOT NULL,
    "end_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'REQUESTED',
    "request_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),
    "reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_snapshots" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "price_per_day_vnd" BIGINT NOT NULL,
    "rental_days" INTEGER NOT NULL,
    "subtotal_vnd" BIGINT NOT NULL,
    "service_fee_vnd" BIGINT NOT NULL,
    "deposit_vnd" BIGINT NOT NULL,
    "total_vnd" BIGINT NOT NULL,
    "pricing_version" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "operation" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "booking_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_calendar" (
    "id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "booking_id" UUID,
    "kind" "CalendarKind" NOT NULL,
    "start_at" TIMESTAMPTZ(6) NOT NULL,
    "end_at" TIMESTAMPTZ(6) NOT NULL,
    "reason" TEXT,
    "released_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_calendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspections" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "type" "InspectionType" NOT NULL,
    "odometer_km" INTEGER NOT NULL,
    "fuel_percent" INTEGER NOT NULL,
    "damage_notes" TEXT,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "finalized_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "performed_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_photos" (
    "inspection_id" UUID NOT NULL,
    "angle" "InspectionAngle" NOT NULL,
    "media_id" UUID NOT NULL,

    CONSTRAINT "inspection_photos_pkey" PRIMARY KEY ("inspection_id","angle")
);

-- CreateTable
CREATE TABLE "keyless_operations" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" "KeylessAction" NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "status" "KeylessOperationStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'SIMULATOR',
    "device_result" TEXT,
    "lease_until" TIMESTAMPTZ(6),
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keyless_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_handovers" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "operation_id" UUID NOT NULL,
    "action" "KeylessAction" NOT NULL,
    "reason" TEXT NOT NULL,
    "owner_confirmed_at" TIMESTAMPTZ(6),
    "renter_confirmed_at" TIMESTAMPTZ(6),
    "finalized_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manual_handovers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "target_user_id" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_events" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "actor_id" UUID,
    "event_type" TEXT NOT NULL,
    "from_status" "BookingStatus",
    "to_status" "BookingStatus",
    "reason" TEXT,
    "operation_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "booking_id" UUID,
    "event_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_normalized_key" ON "users"("email_normalized");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_accounts_provider_subject_key" ON "oauth_accounts"("provider", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_sessions_token_hash_key" ON "refresh_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_sessions_family_id_idx" ON "refresh_sessions"("family_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_plate_normalized_key" ON "vehicles"("plate_normalized");

-- CreateIndex
CREATE INDEX "vehicles_status_city_price_per_day_vnd_idx" ON "vehicles"("status", "city", "price_per_day_vnd");

-- CreateIndex
CREATE UNIQUE INDEX "media_objects_final_key_key" ON "media_objects"("final_key");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_photos_vehicle_id_position_key" ON "vehicle_photos"("vehicle_id", "position");

-- CreateIndex
CREATE INDEX "bookings_renter_id_created_at_idx" ON "bookings"("renter_id", "created_at");

-- CreateIndex
CREATE INDEX "bookings_owner_id_status_idx" ON "bookings"("owner_id", "status");

-- CreateIndex
CREATE INDEX "bookings_status_request_expires_at_idx" ON "bookings"("status", "request_expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_snapshots_booking_id_key" ON "pricing_snapshots"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_actor_id_operation_key_key" ON "idempotency_records"("actor_id", "operation", "key");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_calendar_booking_id_key" ON "vehicle_calendar"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "inspections_booking_id_type_key" ON "inspections"("booking_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "inspection_photos_inspection_id_media_id_key" ON "inspection_photos"("inspection_id", "media_id");

-- CreateIndex
CREATE UNIQUE INDEX "keyless_operations_actor_id_booking_id_action_idempotency_k_key" ON "keyless_operations"("actor_id", "booking_id", "action", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "manual_handovers_operation_id_key" ON "manual_handovers"("operation_id");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_booking_id_author_id_key" ON "reviews"("booking_id", "author_id");

-- CreateIndex
CREATE INDEX "booking_events_booking_id_created_at_idx" ON "booking_events"("booking_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_user_id_event_id_type_key" ON "notifications"("user_id", "event_id", "type");

-- AddForeignKey
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_amenities" ADD CONSTRAINT "vehicle_amenities_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_objects" ADD CONSTRAINT "media_objects_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_objects" ADD CONSTRAINT "media_objects_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_objects" ADD CONSTRAINT "media_objects_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_photos" ADD CONSTRAINT "vehicle_photos_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_photos" ADD CONSTRAINT "vehicle_photos_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_renter_id_fkey" FOREIGN KEY ("renter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_snapshots" ADD CONSTRAINT "pricing_snapshots_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_calendar" ADD CONSTRAINT "vehicle_calendar_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_calendar" ADD CONSTRAINT "vehicle_calendar_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_photos" ADD CONSTRAINT "inspection_photos_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_photos" ADD CONSTRAINT "inspection_photos_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keyless_operations" ADD CONSTRAINT "keyless_operations_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_handovers" ADD CONSTRAINT "manual_handovers_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_handovers" ADD CONSTRAINT "manual_handovers_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "keyless_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- Custom PostgreSQL Extensions, Exclusion Constraints, Partial Indexes & Checks
-- Implemented according to docs/DATABASE_DESIGN.md and G0-07 acceptance criteria
-- =============================================================================

-- 1. Ensure btree_gist extension is enabled for multi-column GiST exclusion constraints
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. Vehicle Calendar Constraints
ALTER TABLE "vehicle_calendar"
  ADD CONSTRAINT "vehicle_calendar_period_valid"
  CHECK ("start_at" < "end_at");

ALTER TABLE "vehicle_calendar"
  ADD CONSTRAINT "vehicle_calendar_no_overlap"
  EXCLUDE USING gist (
    "vehicle_id" WITH =,
    tstzrange("start_at", "end_at", '[)') WITH &&
  ) WHERE ("released_at" IS NULL);

-- 3. Business Partial Unique Indexes
CREATE UNIQUE INDEX "bookings_one_in_progress_per_vehicle"
  ON "bookings"("vehicle_id") WHERE "status" = 'IN_PROGRESS';

CREATE UNIQUE INDEX "keyless_one_unresolved_per_booking"
  ON "keyless_operations"("booking_id")
  WHERE "status" IN ('PENDING', 'UNKNOWN');

-- 4. Vehicle Check Constraints (price > 0 and <= 100M VND)
ALTER TABLE "vehicles"
  ADD CONSTRAINT "vehicles_price_positive_and_cap"
  CHECK ("price_per_day_vnd" > 0 AND "price_per_day_vnd" <= 100000000);

-- 5. Booking Check Constraints (end > start, renter <> owner)
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_end_after_start"
  CHECK ("end_at" > "start_at"),
  ADD CONSTRAINT "bookings_renter_not_owner"
  CHECK ("renter_id" <> "owner_id");

-- 6. Pricing Snapshot Check Constraints (components non-negative and total = subtotal + fee + deposit)
ALTER TABLE "pricing_snapshots"
  ADD CONSTRAINT "pricing_snapshots_non_negative"
  CHECK (
    "price_per_day_vnd" > 0 AND
    "rental_days" > 0 AND
    "subtotal_vnd" >= 0 AND
    "service_fee_vnd" >= 0 AND
    "deposit_vnd" >= 0 AND
    "total_vnd" = ("subtotal_vnd" + "service_fee_vnd" + "deposit_vnd")
  );

-- 7. Inspection Check Constraints (odometer >= 0, fuel 0-100)
ALTER TABLE "inspections"
  ADD CONSTRAINT "inspections_odo_fuel_valid"
  CHECK (
    "odometer_km" >= 0 AND
    "fuel_percent" >= 0 AND
    "fuel_percent" <= 100
  );

-- 8. Review Check Constraints (score 1-5, author <> target)
ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_score_range"
  CHECK ("score" >= 1 AND "score" <= 5),
  ADD CONSTRAINT "reviews_author_not_target"
  CHECK ("author_id" <> "target_user_id");

-- 9. Media Object Check Constraints (size > 0 and <= 5MB)
ALTER TABLE "media_objects"
  ADD CONSTRAINT "media_objects_size_limit"
  CHECK ("size_bytes" > 0 AND "size_bytes" <= 5242880);
