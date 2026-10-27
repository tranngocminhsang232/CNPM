-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('DEPOSIT', 'RENTAL_FEE', 'FULL_PAYMENT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "renter_id" UUID NOT NULL,
    "amount_vnd" BIGINT NOT NULL,
    "payment_type" "PaymentType" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'SANDBOX_GATEWAY',
    "transaction_ref" TEXT NOT NULL,
    "payment_url" TEXT,
    "gateway_txn_id" TEXT,
    "signature" TEXT,
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_transaction_ref_key" ON "payments"("transaction_ref");

-- CreateIndex
CREATE INDEX "payments_booking_id_status_idx" ON "payments"("booking_id", "status");

-- CreateIndex
CREATE INDEX "payments_renter_id_created_at_idx" ON "payments"("renter_id", "created_at");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_renter_id_fkey" FOREIGN KEY ("renter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Business Check Constraint
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_positive"
  CHECK ("amount_vnd" > 0);
