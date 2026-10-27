import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

const TEST_DB_URL =
  process.env.DATABASE_TEST_URL ||
  'postgresql://carsharing:carsharing_local_password@localhost:5433/carsharing_test?schema=public';

describe('PostgreSQL Constraints Integration Test (G0-07)', () => {
  let prisma: PrismaClient;
  let ownerId: string;
  let renterId: string;
  let vehicleId: string;
  let otherVehicleId: string;

  before(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: TEST_DB_URL } },
    });
    await prisma.$connect();

    // Clean up test database before starting
    await prisma.$executeRawUnsafe('DELETE FROM vehicle_calendar;');
    await prisma.$executeRawUnsafe('DELETE FROM keyless_operations;');
    await prisma.$executeRawUnsafe('DELETE FROM pricing_snapshots;');
    await prisma.$executeRawUnsafe('DELETE FROM reviews;');
    await prisma.$executeRawUnsafe('DELETE FROM promotion_usages;');
    await prisma.$executeRawUnsafe('DELETE FROM promotions;');
    await prisma.$executeRawUnsafe('DELETE FROM notifications;');
    await prisma.$executeRawUnsafe('DELETE FROM booking_events;');
    await prisma.$executeRawUnsafe('DELETE FROM idempotency_records;');
    await prisma.$executeRawUnsafe('DELETE FROM payments;');
    await prisma.$executeRawUnsafe('DELETE FROM bookings;');
    await prisma.$executeRawUnsafe('DELETE FROM vehicle_photos;');
    await prisma.$executeRawUnsafe('DELETE FROM vehicle_amenities;');
    await prisma.$executeRawUnsafe('DELETE FROM media_objects;');
    await prisma.$executeRawUnsafe('DELETE FROM driver_licenses;');
    await prisma.$executeRawUnsafe('DELETE FROM vehicles;');
    await prisma.$executeRawUnsafe('DELETE FROM users;');

    // Create test owner and renter
    const owner = await prisma.user.create({
      data: {
        id: randomUUID(),
        name: 'Test Owner',
        emailNormalized: 'owner.test@example.com',
        phone: '0901234567',
      },
    });
    ownerId = owner.id;

    const renter = await prisma.user.create({
      data: {
        id: randomUUID(),
        name: 'Test Renter',
        emailNormalized: 'renter.test@example.com',
        phone: '0907654321',
      },
    });
    renterId = renter.id;

    // Create test vehicles
    const vehicle = await prisma.vehicle.create({
      data: {
        id: randomUUID(),
        ownerId,
        brand: 'VinFast',
        model: 'VF8',
        year: 2024,
        plateNormalized: '51K-99999',
        city: 'TP. Hồ Chí Minh',
        pickupAddress: '123 Nguyễn Huệ, Quận 1',
        carType: 'SUV',
        transmission: 'AUTO',
        seats: 5,
        description: 'Xe thử nghiệm constraint',
        pricePerDayVnd: BigInt(1200000),
        status: 'PUBLISHED',
      },
    });
    vehicleId = vehicle.id;

    const otherVehicle = await prisma.vehicle.create({
      data: {
        id: randomUUID(),
        ownerId,
        brand: 'Hyundai',
        model: 'Ioniq 5',
        year: 2024,
        plateNormalized: '51K-88888',
        city: 'TP. Hồ Chí Minh',
        pickupAddress: '456 Lê Lợi, Quận 1',
        carType: 'CROSSOVER',
        transmission: 'AUTO',
        seats: 5,
        description: 'Xe thử nghiệm 2',
        pricePerDayVnd: BigInt(1500000),
        status: 'PUBLISHED',
      },
    });
    otherVehicleId = otherVehicle.id;
  });

  after(async () => {
    // Cleanup
    await prisma.$executeRawUnsafe('DELETE FROM vehicle_calendar;');
    await prisma.$executeRawUnsafe('DELETE FROM keyless_operations;');
    await prisma.$executeRawUnsafe('DELETE FROM pricing_snapshots;');
    await prisma.$executeRawUnsafe('DELETE FROM reviews;');
    await prisma.$executeRawUnsafe('DELETE FROM bookings;');
    await prisma.$executeRawUnsafe('DELETE FROM vehicles;');
    await prisma.$executeRawUnsafe('DELETE FROM users;');
    await prisma.$disconnect();
  });

  // ---------------------------------------------------------------------------
  // 1. GiST Exclusion Constraint on vehicle_calendar
  // ---------------------------------------------------------------------------
  describe('vehicle_calendar GiST exclusion constraint (no_overlap)', () => {
    it('allows inserting an initial booking period', async () => {
      const startAt = new Date('2026-11-01T08:00:00Z');
      const endAt = new Date('2026-11-01T12:00:00Z');

      const entry = await prisma.vehicleCalendar.create({
        data: {
          id: randomUUID(),
          vehicleId,
          kind: 'BOOKING',
          startAt,
          endAt,
        },
      });

      assert.strictEqual(entry.vehicleId, vehicleId);
    });

    it('rejects an overlapping booking period on the same vehicle (SQLSTATE 23P01)', async () => {
      // Overlaps with [08:00, 12:00) by interval [10:00, 14:00)
      const startAt = new Date('2026-11-01T10:00:00Z');
      const endAt = new Date('2026-11-01T14:00:00Z');

      await assert.rejects(
        async () => {
          await prisma.vehicleCalendar.create({
            data: {
              id: randomUUID(),
              vehicleId,
              kind: 'BOOKING',
              startAt,
              endAt,
            },
          });
        },
        (err: any) => {
          assert.match(err.message, /vehicle_calendar_no_overlap|exclusion constraint|23P01/i);
          return true;
        },
      );
    });

    it('rejects an owner block that conflicts with an existing booking period', async () => {
      // Owner block overlaps [08:00, 12:00) with [07:00, 09:00)
      const startAt = new Date('2026-11-01T07:00:00Z');
      const endAt = new Date('2026-11-01T09:00:00Z');

      await assert.rejects(
        async () => {
          await prisma.vehicleCalendar.create({
            data: {
              id: randomUUID(),
              vehicleId,
              kind: 'OWNER_BLOCK',
              startAt,
              endAt,
              reason: 'Bảo dưỡng định kỳ',
            },
          });
        },
        (err: any) => {
          assert.match(err.message, /vehicle_calendar_no_overlap|exclusion constraint|23P01/i);
          return true;
        },
      );
    });

    it('allows a touching period [12:00, 16:00) adjacent to [08:00, 12:00) under [) range semantics', async () => {
      // Touching: startAt exactly equals previous endAt (12:00)
      const startAt = new Date('2026-11-01T12:00:00Z');
      const endAt = new Date('2026-11-01T16:00:00Z');

      const entry = await prisma.vehicleCalendar.create({
        data: {
          id: randomUUID(),
          vehicleId,
          kind: 'BOOKING',
          startAt,
          endAt,
        },
      });

      assert.strictEqual(entry.vehicleId, vehicleId);
    });

    it('allows overlapping period on a DIFFERENT vehicle', async () => {
      // Overlaps with vehicleId's interval, but belongs to otherVehicleId
      const startAt = new Date('2026-11-01T08:00:00Z');
      const endAt = new Date('2026-11-01T12:00:00Z');

      const entry = await prisma.vehicleCalendar.create({
        data: {
          id: randomUUID(),
          vehicleId: otherVehicleId,
          kind: 'BOOKING',
          startAt,
          endAt,
        },
      });

      assert.strictEqual(entry.vehicleId, otherVehicleId);
    });

    it('allows an overlapping period if the previous record was released (released_at IS NOT NULL)', async () => {
      const releaseStart = new Date('2026-11-02T10:00:00Z');
      const releaseEnd = new Date('2026-11-02T14:00:00Z');

      // Create an already-released record (e.g. cancelled booking)
      await prisma.vehicleCalendar.create({
        data: {
          id: randomUUID(),
          vehicleId,
          kind: 'BOOKING',
          startAt: releaseStart,
          endAt: releaseEnd,
          releasedAt: new Date('2026-11-02T09:00:00Z'),
        },
      });

      // Now create an overlapping active record
      const activeEntry = await prisma.vehicleCalendar.create({
        data: {
          id: randomUUID(),
          vehicleId,
          kind: 'BOOKING',
          startAt: releaseStart,
          endAt: releaseEnd,
        },
      });

      assert.strictEqual(activeEntry.vehicleId, vehicleId);
    });

    it('rejects vehicle_calendar when start_at >= end_at (check constraint)', async () => {
      await assert.rejects(
        async () => {
          await prisma.vehicleCalendar.create({
            data: {
              id: randomUUID(),
              vehicleId,
              kind: 'BOOKING',
              startAt: new Date('2026-11-03T12:00:00Z'),
              endAt: new Date('2026-11-03T08:00:00Z'), // Invalid: end < start
            },
          });
        },
        (err: any) => {
          assert.match(err.message, /vehicle_calendar_period_valid|check constraint/i);
          return true;
        },
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Partial Unique Index: bookings_one_in_progress_per_vehicle
  // ---------------------------------------------------------------------------
  describe('bookings_one_in_progress_per_vehicle partial unique index', () => {
    it('allows multiple bookings in non-IN_PROGRESS status (REQUESTED, APPROVED, etc.)', async () => {
      const b1 = await prisma.booking.create({
        data: {
          id: randomUUID(),
          vehicleId,
          renterId,
          ownerId,
          startAt: new Date('2026-11-10T08:00:00Z'),
          endAt: new Date('2026-11-10T18:00:00Z'),
          status: 'REQUESTED',
          requestExpiresAt: new Date('2026-11-09T08:00:00Z'),
        },
      });

      const b2 = await prisma.booking.create({
        data: {
          id: randomUUID(),
          vehicleId,
          renterId,
          ownerId,
          startAt: new Date('2026-11-11T08:00:00Z'),
          endAt: new Date('2026-11-11T18:00:00Z'),
          status: 'APPROVED',
          requestExpiresAt: new Date('2026-11-09T08:00:00Z'),
        },
      });

      assert.ok(b1.id && b2.id);
    });

    it('allows a single IN_PROGRESS booking on a vehicle', async () => {
      const booking = await prisma.booking.create({
        data: {
          id: randomUUID(),
          vehicleId,
          renterId,
          ownerId,
          startAt: new Date('2026-11-12T08:00:00Z'),
          endAt: new Date('2026-11-12T18:00:00Z'),
          status: 'IN_PROGRESS',
          requestExpiresAt: new Date('2026-11-09T08:00:00Z'),
        },
      });

      assert.strictEqual(booking.status, 'IN_PROGRESS');
    });

    it('rejects a SECOND IN_PROGRESS booking on the same vehicle', async () => {
      await assert.rejects(
        async () => {
          await prisma.booking.create({
            data: {
              id: randomUUID(),
              vehicleId, // Same vehicle!
              renterId,
              ownerId,
              startAt: new Date('2026-11-13T08:00:00Z'),
              endAt: new Date('2026-11-13T18:00:00Z'),
              status: 'IN_PROGRESS',
              requestExpiresAt: new Date('2026-11-09T08:00:00Z'),
            },
          });
        },
        (err: any) => {
          assert.match(err.message, /bookings_one_in_progress_per_vehicle|unique constraint/i);
          return true;
        },
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Partial Unique Index: keyless_one_unresolved_per_booking
  // ---------------------------------------------------------------------------
  describe('keyless_one_unresolved_per_booking partial unique index', () => {
    let testBookingId: string;

    before(async () => {
      const b = await prisma.booking.create({
        data: {
          id: randomUUID(),
          vehicleId: otherVehicleId,
          renterId,
          ownerId,
          startAt: new Date('2026-11-14T08:00:00Z'),
          endAt: new Date('2026-11-14T18:00:00Z'),
          status: 'APPROVED',
          requestExpiresAt: new Date('2026-11-09T08:00:00Z'),
        },
      });
      testBookingId = b.id;
    });

    it('allows inserting a PENDING keyless operation', async () => {
      const op = await prisma.keylessOperation.create({
        data: {
          id: randomUUID(),
          bookingId: testBookingId,
          actorId: renterId,
          action: 'UNLOCK',
          idempotencyKey: 'keyless-op-1',
          requestHash: 'hash1',
          status: 'PENDING',
        },
      });
      assert.strictEqual(op.status, 'PENDING');
    });

    it('rejects a second UNRESOLVED (PENDING or UNKNOWN) operation on the same booking', async () => {
      await assert.rejects(
        async () => {
          await prisma.keylessOperation.create({
            data: {
              id: randomUUID(),
              bookingId: testBookingId,
              actorId: renterId,
              action: 'LOCK',
              idempotencyKey: 'keyless-op-2',
              requestHash: 'hash2',
              status: 'PENDING',
            },
          });
        },
        (err: any) => {
          assert.match(err.message, /keyless_one_unresolved_per_booking|unique constraint/i);
          return true;
        },
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Business Check Constraints
  // ---------------------------------------------------------------------------
  describe('Business Check Constraints', () => {
    it('rejects vehicle when pricePerDayVnd <= 0 or > 100M VND', async () => {
      // Test price = 0
      await assert.rejects(
        async () => {
          await prisma.vehicle.create({
            data: {
              id: randomUUID(),
              ownerId,
              brand: 'Toyota',
              model: 'Vios',
              year: 2023,
              plateNormalized: '51K-00001',
              city: 'TP. Hồ Chí Minh',
              pickupAddress: '123 Test',
              carType: 'SEDAN',
              transmission: 'AUTO',
              seats: 5,
              description: 'Zero price',
              pricePerDayVnd: BigInt(0), // INVALID
            },
          });
        },
        (err: any) => {
          assert.match(err.message, /vehicles_price_positive_and_cap|check constraint/i);
          return true;
        },
      );

      // Test price > 100M
      await assert.rejects(
        async () => {
          await prisma.vehicle.create({
            data: {
              id: randomUUID(),
              ownerId,
              brand: 'Rolls Royce',
              model: 'Phantom',
              year: 2024,
              plateNormalized: '51K-00002',
              city: 'TP. Hồ Chí Minh',
              pickupAddress: '123 Test',
              carType: 'SEDAN',
              transmission: 'AUTO',
              seats: 5,
              description: 'Exceeding cap',
              pricePerDayVnd: BigInt(100000001), // INVALID: > 100M
            },
          });
        },
        (err: any) => {
          assert.match(err.message, /vehicles_price_positive_and_cap|check constraint/i);
          return true;
        },
      );
    });

    it('rejects booking when renter_id == owner_id', async () => {
      await assert.rejects(
        async () => {
          await prisma.booking.create({
            data: {
              id: randomUUID(),
              vehicleId,
              renterId: ownerId, // Same as ownerId!
              ownerId,
              startAt: new Date('2026-11-20T08:00:00Z'),
              endAt: new Date('2026-11-20T18:00:00Z'),
              status: 'REQUESTED',
              requestExpiresAt: new Date('2026-11-19T08:00:00Z'),
            },
          });
        },
        (err: any) => {
          assert.match(err.message, /bookings_renter_not_owner|check constraint/i);
          return true;
        },
      );
    });

    it('rejects booking when end_at <= start_at', async () => {
      await assert.rejects(
        async () => {
          await prisma.booking.create({
            data: {
              id: randomUUID(),
              vehicleId,
              renterId,
              ownerId,
              startAt: new Date('2026-11-20T18:00:00Z'),
              endAt: new Date('2026-11-20T08:00:00Z'), // Invalid: end < start
              status: 'REQUESTED',
              requestExpiresAt: new Date('2026-11-19T08:00:00Z'),
            },
          });
        },
        (err: any) => {
          assert.match(err.message, /bookings_end_after_start|check constraint/i);
          return true;
        },
      );
    });

    it('rejects pricing snapshot when total != subtotal + service_fee + deposit', async () => {
      const b = await prisma.booking.create({
        data: {
          id: randomUUID(),
          vehicleId: otherVehicleId,
          renterId,
          ownerId,
          startAt: new Date('2026-11-21T08:00:00Z'),
          endAt: new Date('2026-11-21T18:00:00Z'),
          status: 'REQUESTED',
          requestExpiresAt: new Date('2026-11-20T08:00:00Z'),
        },
      });

      await assert.rejects(
        async () => {
          await prisma.pricingSnapshot.create({
            data: {
              id: randomUUID(),
              bookingId: b.id,
              currency: 'VND',
              pricePerDayVnd: BigInt(1000000),
              rentalDays: 1,
              subtotalVnd: BigInt(1000000),
              serviceFeeVnd: BigInt(100000),
              depositVnd: BigInt(5000000),
              totalVnd: BigInt(9999999), // Inconsistent: 1M + 100k + 5M = 6.1M != 9999999
              pricingVersion: '1.0',
            },
          });
        },
        (err: any) => {
          assert.match(err.message, /pricing_snapshots_non_negative|check constraint/i);
          return true;
        },
      );
    });

    it('rejects review when score is not between 1 and 5', async () => {
      const b = await prisma.booking.create({
        data: {
          id: randomUUID(),
          vehicleId: otherVehicleId,
          renterId,
          ownerId,
          startAt: new Date('2026-11-22T08:00:00Z'),
          endAt: new Date('2026-11-22T18:00:00Z'),
          status: 'COMPLETED',
          requestExpiresAt: new Date('2026-11-20T08:00:00Z'),
        },
      });

      await assert.rejects(
        async () => {
          await prisma.review.create({
            data: {
              id: randomUUID(),
              bookingId: b.id,
              authorId: renterId,
              targetUserId: ownerId,
              score: 6, // INVALID: score > 5
              comment: 'Great ride!',
            },
          });
        },
        (err: any) => {
          assert.match(err.message, /reviews_score_range|check constraint/i);
          return true;
        },
      );
    });

    it('rejects review when author_id == target_user_id', async () => {
      const b = await prisma.booking.create({
        data: {
          id: randomUUID(),
          vehicleId: otherVehicleId,
          renterId,
          ownerId,
          startAt: new Date('2026-11-23T08:00:00Z'),
          endAt: new Date('2026-11-23T18:00:00Z'),
          status: 'COMPLETED',
          requestExpiresAt: new Date('2026-11-20T08:00:00Z'),
        },
      });

      await assert.rejects(
        async () => {
          await prisma.review.create({
            data: {
              id: randomUUID(),
              bookingId: b.id,
              authorId: renterId,
              targetUserId: renterId, // Self review!
              score: 5,
              comment: 'Self praise!',
            },
          });
        },
        (err: any) => {
          assert.match(err.message, /reviews_author_not_target|check constraint/i);
          return true;
        },
      );
    });
  });
});
