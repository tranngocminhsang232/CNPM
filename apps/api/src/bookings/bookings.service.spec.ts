import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { BookingsService, computeBookingHash } from './bookings.service';
import { InsurancePackageTier } from '../pricing/dto/calculate-pricing.dto';

describe('BookingsService (unit)', () => {
  let service: BookingsService;
  let mockPrisma: any;
  let mockPricingService: any;

  const ACTOR_RENTER = '00000000-0000-0000-0000-000000000003';
  const ACTOR_OWNER = '00000000-0000-0000-0000-000000000001';
  const THIRD_PARTY = '00000000-0000-0000-0000-000000000009';
  const VEHICLE_ID = '10000000-0000-0000-0000-000000000001';
  const IDEMPOTENCY_KEY = 'idem-key-test-booking-123456';

  const mockVehicle = {
    id: VEHICLE_ID,
    ownerId: ACTOR_OWNER,
    brand: 'VinFast',
    model: 'VF8 Plus',
    year: 2024,
    city: 'TP. Hồ Chí Minh',
    pickupAddress: 'Vinhomes Central Park, Bình Thạnh',
    plateNormalized: '51K-10001',
    pricePerDayVnd: BigInt(1400000),
    keylessSupported: true,
    status: 'PUBLISHED',
  };

  const mockQuote = {
    vehicleId: VEHICLE_ID,
    startAt: '2026-11-10T08:00:00.000Z',
    endAt: '2026-11-12T18:00:00.000Z',
    pricePerDayVnd: 1400000,
    rentalDays: 3,
    subtotalVnd: 4200000,
    serviceFeeVnd: 420000,
    depositVnd: 10000000,
    totalVnd: 14620000,
    pricingVersion: 'daily-v1',
    breakdown: {
      rentalDays: 3,
      pricePerDayVnd: 1400000,
      baseRentVnd: 4200000,
      peakSurchargeVnd: 0,
      insuranceFeeVnd: 0,
      discountVnd: 0,
      subtotalVnd: 4200000,
      serviceFeeVnd: 420000,
      depositVnd: 10000000,
      totalVnd: 14620000,
    },
    available: true,
  };

  beforeEach(() => {
    mockPrisma = {
      idempotencyRecord: {
        findUnique: async () => null,
        create: async (args: any) => args.data,
      },
      vehicle: {
        findUnique: async ({ where }: any) => {
          if (where.id === VEHICLE_ID) return mockVehicle;
          return null;
        },
      },
      booking: {
        findUnique: async () => null,
        findUniqueOrThrow: async () => null,
        create: async (args: any) => ({
          id: '20000000-0000-0000-0000-000000000099',
          ...args.data,
          version: 1,
          createdAt: new Date(),
        }),
        update: async (args: any) => ({
          id: args.where.id,
          status: args.data.status,
          reason: args.data.reason || null,
          version: 2,
          renterId: ACTOR_RENTER,
          ownerId: ACTOR_OWNER,
          vehicle: mockVehicle,
          pricingSnapshot: {
            currency: 'VND',
            pricePerDayVnd: BigInt(1400000),
            rentalDays: 3,
            subtotalVnd: BigInt(4200000),
            serviceFeeVnd: BigInt(420000),
            depositVnd: BigInt(10000000),
            totalVnd: BigInt(14620000),
            pricingVersion: 'daily-v1',
          },
        }),
        count: async () => 1,
        findMany: async () => [],
      },
      pricingSnapshot: {
        create: async (args: any) => args.data,
      },
      vehicleCalendar: {
        create: async (args: any) => args.data,
        updateMany: async () => ({ count: 1 }),
      },
      promotion: {
        findUnique: async () => null,
        update: async () => ({}),
      },
      promotionUsage: {
        create: async () => ({}),
        findFirst: async () => null,
        delete: async () => ({}),
      },
      bookingEvent: {
        create: async (args: any) => ({ id: 'event-uuid-1', ...args.data }),
      },
      notification: {
        create: async (args: any) => ({ id: 'notif-uuid-1', ...args.data }),
      },
      keylessOperation: {
        findFirst: async () => null,
      },
      $transaction: async (cb: any) => cb(mockPrisma),
    };

    mockPricingService = {
      calculateQuote: async () => mockQuote,
    };

    service = new BookingsService(mockPrisma, mockPricingService);
  });

  describe('computeBookingHash', () => {
    it('produces deterministic sha256 regardless of case or number representation', () => {
      const hash1 = computeBookingHash({
        vehicleId: '10000000-0000-0000-0000-000000000001',
        startAt: '2026-11-10T08:00:00.000Z',
        endAt: '2026-11-12T18:00:00.000Z',
        expectedTotalVnd: 14620000,
        pricingVersion: 'daily-v1',
      });

      const hash2 = computeBookingHash({
        vehicleId: '10000000-0000-0000-0000-000000000001',
        startAt: '2026-11-10T08:00:00.000Z',
        endAt: '2026-11-12T18:00:00.000Z',
        expectedTotalVnd: BigInt(14620000),
        pricingVersion: 'daily-v1',
      });

      assert.equal(hash1, hash2);
      assert.equal(typeof hash1, 'string');
      assert.equal(hash1.length, 64);
    });
  });

  describe('createBooking', () => {
    const validDto = {
      vehicleId: VEHICLE_ID,
      startAt: '2026-11-10T08:00:00.000Z',
      endAt: '2026-11-12T18:00:00.000Z',
      expectedTotalVnd: 14620000,
      pricingVersion: 'daily-v1',
      insurancePackage: InsurancePackageTier.BASIC,
    };

    it('rejects invalid Idempotency-Key length < 16', async () => {
      await assert.rejects(
        () => service.createBooking(ACTOR_RENTER, 'short-key', validDto),
        (err: any) => {
          assert.ok(err instanceof BadRequestException);
          assert.equal((err.getResponse() as any).code, 'VALIDATION_ERROR');
          return true;
        },
      );
    });

    it('rejects Idempotency-Key containing invalid special characters', async () => {
      await assert.rejects(
        () => service.createBooking(ACTOR_RENTER, 'key-with-invalid-chars!@#$', validDto),
        (err: any) => {
          assert.ok(err instanceof BadRequestException);
          assert.equal((err.getResponse() as any).code, 'VALIDATION_ERROR');
          return true;
        },
      );
    });

    it('replays existing booking when idempotency record has matching hash (isReplay: true)', async () => {
      const canonicalHash = computeBookingHash({
        vehicleId: validDto.vehicleId,
        startAt: validDto.startAt,
        endAt: validDto.endAt,
        expectedTotalVnd: validDto.expectedTotalVnd,
        pricingVersion: validDto.pricingVersion,
      });

      mockPrisma.idempotencyRecord.findUnique = async () => ({
        requestHash: canonicalHash,
        booking: {
          id: '20000000-0000-0000-0000-000000000001',
          vehicleId: VEHICLE_ID,
          renterId: ACTOR_RENTER,
          ownerId: ACTOR_OWNER,
          startAt: new Date(validDto.startAt),
          endAt: new Date(validDto.endAt),
          status: 'REQUESTED',
          requestExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
          completedAt: null,
          reason: null,
          version: 1,
          createdAt: new Date(),
          pricingSnapshot: {
            currency: 'VND',
            pricePerDayVnd: BigInt(1400000),
            rentalDays: 3,
            subtotalVnd: BigInt(4200000),
            serviceFeeVnd: BigInt(420000),
            depositVnd: BigInt(10000000),
            totalVnd: BigInt(14620000),
            pricingVersion: 'daily-v1',
          },
          vehicle: mockVehicle,
          renter: { id: ACTOR_RENTER, name: 'Khách 1', phone: '0903333333' },
          owner: { id: ACTOR_OWNER, name: 'Chủ 1', phone: '0901111111' },
        },
      });

      const result = await service.createBooking(ACTOR_RENTER, IDEMPOTENCY_KEY, validDto);
      assert.equal(result.isReplay, true);
      assert.equal(result.booking.id, '20000000-0000-0000-0000-000000000001');
      assert.equal(result.booking.status, 'REQUESTED');
    });

    it('rejects 409 IDEMPOTENCY_MISMATCH when same key is reused with different payload', async () => {
      mockPrisma.idempotencyRecord.findUnique = async () => ({
        requestHash: 'different-hash-from-previous-request',
        booking: {},
      });

      await assert.rejects(
        () => service.createBooking(ACTOR_RENTER, IDEMPOTENCY_KEY, validDto),
        (err: any) => {
          assert.ok(err instanceof ConflictException);
          assert.equal((err.getResponse() as any).code, 'IDEMPOTENCY_MISMATCH');
          return true;
        },
      );
    });

    it('rejects 400 when endAt <= startAt', async () => {
      await assert.rejects(
        () =>
          service.createBooking(ACTOR_RENTER, IDEMPOTENCY_KEY, {
            ...validDto,
            endAt: '2026-11-10T08:00:00.000Z', // Same as startAt
          }),
        (err: any) => {
          assert.ok(err instanceof BadRequestException);
          return true;
        },
      );
    });

    it('rejects 422 INVALID_RENTAL_PERIOD when duration < 1 hour', async () => {
      await assert.rejects(
        () =>
          service.createBooking(ACTOR_RENTER, IDEMPOTENCY_KEY, {
            ...validDto,
            endAt: '2026-11-10T08:30:00.000Z', // 30 minutes
          }),
        (err: any) => {
          assert.ok(err instanceof UnprocessableEntityException);
          assert.equal((err.getResponse() as any).code, 'INVALID_RENTAL_PERIOD');
          return true;
        },
      );
    });

    it('rejects 404 when vehicle is not found or not published', async () => {
      await assert.rejects(
        () =>
          service.createBooking(ACTOR_RENTER, IDEMPOTENCY_KEY, {
            ...validDto,
            vehicleId: 'non-existent-vehicle-id-12345678',
          }),
        (err: any) => {
          assert.ok(err instanceof NotFoundException);
          return true;
        },
      );
    });

    it('rejects 403 SELF_BOOKING_FORBIDDEN when owner attempts to book their own vehicle', async () => {
      await assert.rejects(
        () => service.createBooking(ACTOR_OWNER, IDEMPOTENCY_KEY, validDto),
        (err: any) => {
          assert.ok(err instanceof ForbiddenException);
          assert.equal((err.getResponse() as any).code, 'SELF_BOOKING_FORBIDDEN');
          return true;
        },
      );
    });

    it('rejects 409 VEHICLE_UNAVAILABLE when quote reveals calendar conflict', async () => {
      mockPricingService.calculateQuote = async () => ({
        ...mockQuote,
        available: false,
        unavailableReason: 'Xe đã có lịch đặt trong thời gian này',
      });

      await assert.rejects(
        () => service.createBooking(ACTOR_RENTER, IDEMPOTENCY_KEY, validDto),
        (err: any) => {
          assert.ok(err instanceof ConflictException);
          assert.equal((err.getResponse() as any).code, 'VEHICLE_UNAVAILABLE');
          return true;
        },
      );
    });

    it('rejects 409 PRICE_CHANGED when quote total differs from expectedTotalVnd', async () => {
      mockPricingService.calculateQuote = async () => ({
        ...mockQuote,
        totalVnd: 15000000, // Price updated
      });

      await assert.rejects(
        () => service.createBooking(ACTOR_RENTER, IDEMPOTENCY_KEY, validDto),
        (err: any) => {
          assert.ok(err instanceof ConflictException);
          assert.equal((err.getResponse() as any).code, 'PRICE_CHANGED');
          return true;
        },
      );
    });

    it('creates new booking with 201 Created and holds calendar in REQUESTED state', async () => {
      mockPrisma.booking.findUniqueOrThrow = async () => ({
        id: '20000000-0000-0000-0000-000000000099',
        vehicleId: VEHICLE_ID,
        renterId: ACTOR_RENTER,
        ownerId: ACTOR_OWNER,
        startAt: new Date(validDto.startAt),
        endAt: new Date(validDto.endAt),
        status: 'REQUESTED',
        requestExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        completedAt: null,
        reason: null,
        version: 1,
        createdAt: new Date(),
        pricingSnapshot: {
          currency: 'VND',
          pricePerDayVnd: BigInt(1400000),
          rentalDays: 3,
          subtotalVnd: BigInt(4200000),
          serviceFeeVnd: BigInt(420000),
          depositVnd: BigInt(10000000),
          totalVnd: BigInt(14620000),
          pricingVersion: 'daily-v1',
        },
        vehicle: mockVehicle,
        renter: { id: ACTOR_RENTER, name: 'Khách 1', phone: '0903333333' },
        owner: { id: ACTOR_OWNER, name: 'Chủ 1', phone: '0901111111' },
      });

      const result = await service.createBooking(ACTOR_RENTER, IDEMPOTENCY_KEY, validDto);
      assert.equal(result.isReplay, false);
      assert.equal(result.booking.status, 'REQUESTED');
      assert.equal(result.booking.pricingSnapshot?.totalVnd, 14620000);
      // Privacy check: Renter cannot see plateNormalized or pickupAddress in REQUESTED status
      assert.equal(result.booking.vehicle?.plateNormalized, null);
      assert.equal(result.booking.vehicle?.pickupAddress, null);
    });
  });

  describe('approveBooking', () => {
    it('rejects 404 if booking not found', async () => {
      mockPrisma.booking.findUnique = async () => null;
      await assert.rejects(
        () => service.approveBooking('missing-id', ACTOR_OWNER),
        (err: any) => err instanceof NotFoundException,
      );
    });

    it('rejects 403 if non-owner tries to approve', async () => {
      mockPrisma.booking.findUnique = async () => ({
        id: 'b-1',
        ownerId: ACTOR_OWNER,
        status: 'REQUESTED',
      });

      await assert.rejects(
        () => service.approveBooking('b-1', THIRD_PARTY),
        (err: any) => err instanceof ForbiddenException,
      );
    });

    it('rejects 409 if status is not REQUESTED', async () => {
      mockPrisma.booking.findUnique = async () => ({
        id: 'b-1',
        ownerId: ACTOR_OWNER,
        status: 'APPROVED',
      });

      await assert.rejects(
        () => service.approveBooking('b-1', ACTOR_OWNER),
        (err: any) => err instanceof ConflictException,
      );
    });

    it('successfully approves booking and transitions to APPROVED', async () => {
      mockPrisma.booking.findUnique = async () => ({
        id: 'b-1',
        ownerId: ACTOR_OWNER,
        renterId: ACTOR_RENTER,
        status: 'REQUESTED',
        version: 1,
      });

      const result = await service.approveBooking('b-1', ACTOR_OWNER);
      assert.equal(result.status, 'APPROVED');
    });
  });

  describe('rejectBooking', () => {
    it('rejects 403 if non-owner tries to reject', async () => {
      mockPrisma.booking.findUnique = async () => ({
        id: 'b-1',
        ownerId: ACTOR_OWNER,
        status: 'REQUESTED',
      });

      await assert.rejects(
        () => service.rejectBooking('b-1', ACTOR_RENTER, 'Lý do từ chối'),
        (err: any) => err instanceof ForbiddenException,
      );
    });

    it('successfully rejects booking and releases calendar hold', async () => {
      let calendarReleased = false;
      mockPrisma.vehicleCalendar.updateMany = async () => {
        calendarReleased = true;
        return { count: 1 };
      };

      mockPrisma.booking.findUnique = async () => ({
        id: 'b-1',
        ownerId: ACTOR_OWNER,
        renterId: ACTOR_RENTER,
        status: 'REQUESTED',
        version: 1,
      });

      const result = await service.rejectBooking('b-1', ACTOR_OWNER, 'Xe cần bảo dưỡng đột xuất');
      assert.equal(result.status, 'REJECTED');
      assert.equal(calendarReleased, true);
    });
  });

  describe('cancelBooking', () => {
    it('rejects 403 if unrelated user tries to cancel', async () => {
      mockPrisma.booking.findUnique = async () => ({
        id: 'b-1',
        ownerId: ACTOR_OWNER,
        renterId: ACTOR_RENTER,
        status: 'REQUESTED',
      });

      await assert.rejects(
        () => service.cancelBooking('b-1', THIRD_PARTY, 'Hủy đơn'),
        (err: any) => err instanceof ForbiddenException,
      );
    });

    it('allows renter to cancel REQUESTED booking and releases calendar', async () => {
      let calendarReleased = false;
      mockPrisma.vehicleCalendar.updateMany = async () => {
        calendarReleased = true;
        return { count: 1 };
      };

      mockPrisma.booking.findUnique = async () => ({
        id: 'b-1',
        ownerId: ACTOR_OWNER,
        renterId: ACTOR_RENTER,
        status: 'REQUESTED',
        version: 1,
      });

      const result = await service.cancelBooking(
        'b-1',
        ACTOR_RENTER,
        'Thay đổi lịch trình công tác',
      );
      assert.equal(result.status, 'CANCELLED');
      assert.equal(calendarReleased, true);
    });
  });

  describe('getBookingById', () => {
    it('rejects 403 if third party tries to view private booking', async () => {
      mockPrisma.booking.findUnique = async () => ({
        id: 'b-1',
        ownerId: ACTOR_OWNER,
        renterId: ACTOR_RENTER,
        status: 'REQUESTED',
      });

      await assert.rejects(
        () => service.getBookingById('b-1', THIRD_PARTY),
        (err: any) => err instanceof ForbiddenException,
      );
    });

    it('reveals plateNormalized and pickupAddress to renter once APPROVED', async () => {
      mockPrisma.booking.findUnique = async () => ({
        id: 'b-1',
        ownerId: ACTOR_OWNER,
        renterId: ACTOR_RENTER,
        startAt: new Date(),
        endAt: new Date(),
        status: 'APPROVED',
        requestExpiresAt: new Date(),
        version: 2,
        createdAt: new Date(),
        vehicle: mockVehicle,
        pricingSnapshot: {
          currency: 'VND',
          pricePerDayVnd: BigInt(1400000),
          rentalDays: 3,
          subtotalVnd: BigInt(4200000),
          serviceFeeVnd: BigInt(420000),
          depositVnd: BigInt(10000000),
          totalVnd: BigInt(14620000),
          pricingVersion: 'daily-v1',
        },
      });

      const result = await service.getBookingById('b-1', ACTOR_RENTER);
      assert.equal(result.vehicle?.plateNormalized, '51K-10001');
      assert.equal(result.vehicle?.pickupAddress, 'Vinhomes Central Park, Bình Thạnh');
    });
  });

  describe('completeBooking', () => {
    const validCheckIn = {
      id: 'insp-in-1',
      type: 'CHECK_IN',
      odometerKm: 15000,
      fuelPercent: 90,
      acknowledged: true,
      finalizedAt: new Date(),
      photos: [],
    };

    const validCheckOut = {
      id: 'insp-out-1',
      type: 'CHECK_OUT',
      odometerKm: 15350,
      fuelPercent: 85,
      acknowledged: true,
      finalizedAt: new Date(),
      photos: [],
    };

    it('rejects 404 if booking not found', async () => {
      mockPrisma.booking.findUnique = async () => null;

      await assert.rejects(
        () => service.completeBooking('non-existent', ACTOR_RENTER),
        (err: any) =>
          err instanceof NotFoundException && (err.getResponse() as any)?.code === 'NOT_FOUND',
      );
    });

    it('rejects 403 if non-renter tries to complete the trip', async () => {
      mockPrisma.booking.findUnique = async () => ({
        id: 'b-1',
        renterId: ACTOR_RENTER,
        ownerId: ACTOR_OWNER,
        status: 'IN_PROGRESS',
        inspections: [],
      });

      await assert.rejects(
        () => service.completeBooking('b-1', THIRD_PARTY),
        (err: any) =>
          err instanceof ForbiddenException && (err.getResponse() as any)?.code === 'FORBIDDEN',
      );
    });

    it('returns booking idempotently if already COMPLETED', async () => {
      mockPrisma.booking.findUnique = async () => ({
        id: 'b-1',
        renterId: ACTOR_RENTER,
        ownerId: ACTOR_OWNER,
        status: 'COMPLETED',
        startAt: new Date(),
        endAt: new Date(),
        version: 3,
        createdAt: new Date(),
        vehicle: mockVehicle,
        pricingSnapshot: {
          currency: 'VND',
          pricePerDayVnd: BigInt(1400000),
          rentalDays: 3,
          subtotalVnd: BigInt(4200000),
          serviceFeeVnd: BigInt(420000),
          depositVnd: BigInt(10000000),
          totalVnd: BigInt(14620000),
          pricingVersion: 'daily-v1',
        },
        inspections: [validCheckIn, validCheckOut],
      });

      const res = await service.completeBooking('b-1', ACTOR_RENTER);
      assert.equal(res.status, 'COMPLETED');
    });

    it('rejects 409 INVALID_TRANSITION if status is not IN_PROGRESS', async () => {
      mockPrisma.booking.findUnique = async () => ({
        id: 'b-1',
        renterId: ACTOR_RENTER,
        ownerId: ACTOR_OWNER,
        status: 'APPROVED',
        inspections: [],
      });

      await assert.rejects(
        () => service.completeBooking('b-1', ACTOR_RENTER),
        (err: any) =>
          err instanceof ConflictException &&
          (err.getResponse() as any)?.code === 'INVALID_TRANSITION',
      );
    });

    it('rejects 409 UNRESOLVED_OPERATION if there is a pending keyless operation', async () => {
      mockPrisma.booking.findUnique = async () => ({
        id: 'b-1',
        renterId: ACTOR_RENTER,
        ownerId: ACTOR_OWNER,
        status: 'IN_PROGRESS',
        inspections: [validCheckIn, validCheckOut],
      });

      mockPrisma.keylessOperation.findFirst = async () => ({
        id: 'op-1',
        bookingId: 'b-1',
        status: 'PENDING',
      });

      await assert.rejects(
        () => service.completeBooking('b-1', ACTOR_RENTER),
        (err: any) =>
          err instanceof ConflictException &&
          (err.getResponse() as any)?.code === 'UNRESOLVED_OPERATION',
      );
    });

    it('rejects 422 CHECKLIST_INCOMPLETE if CHECK_OUT inspection is missing or not finalized', async () => {
      mockPrisma.booking.findUnique = async () => ({
        id: 'b-1',
        renterId: ACTOR_RENTER,
        ownerId: ACTOR_OWNER,
        status: 'IN_PROGRESS',
        inspections: [validCheckIn], // No CHECK_OUT
      });

      await assert.rejects(
        () => service.completeBooking('b-1', ACTOR_RENTER),
        (err: any) =>
          err instanceof UnprocessableEntityException &&
          (err.getResponse() as any)?.code === 'CHECKLIST_INCOMPLETE',
      );
    });

    it('rejects 422 INVALID_ODOMETER if CHECK_OUT odo is less than CHECK_IN odo', async () => {
      const invalidOdoCheckOut = {
        ...validCheckOut,
        odometerKm: 14000, // less than check-in 15000
      };

      mockPrisma.booking.findUnique = async () => ({
        id: 'b-1',
        renterId: ACTOR_RENTER,
        ownerId: ACTOR_OWNER,
        status: 'IN_PROGRESS',
        inspections: [validCheckIn, invalidOdoCheckOut],
      });

      await assert.rejects(
        () => service.completeBooking('b-1', ACTOR_RENTER),
        (err: any) =>
          err instanceof UnprocessableEntityException &&
          (err.getResponse() as any)?.code === 'INVALID_ODOMETER',
      );
    });

    it('successfully completes booking, releases vehicle calendar, creates TRIP_COMPLETED event and notifies parties', async () => {
      let releasedCalendar = false;
      let recordedEvent: any = null;
      const recordedNotifs: any[] = [];

      mockPrisma.booking.findUnique = async () => ({
        id: 'b-1',
        renterId: ACTOR_RENTER,
        ownerId: ACTOR_OWNER,
        status: 'IN_PROGRESS',
        version: 2,
        inspections: [validCheckIn, validCheckOut],
      });

      mockPrisma.booking.update = async (args: any) => ({
        id: 'b-1',
        renterId: ACTOR_RENTER,
        ownerId: ACTOR_OWNER,
        status: args.data.status,
        version: 3,
        vehicle: mockVehicle,
        pricingSnapshot: {
          currency: 'VND',
          pricePerDayVnd: BigInt(1400000),
          rentalDays: 3,
          subtotalVnd: BigInt(4200000),
          serviceFeeVnd: BigInt(420000),
          depositVnd: BigInt(10000000),
          totalVnd: BigInt(14620000),
          pricingVersion: 'daily-v1',
        },
        renter: { id: ACTOR_RENTER, name: 'Renter Test', phone: '0901234567' },
        owner: { id: ACTOR_OWNER, name: 'Owner Test', phone: '0907654321' },
      });

      mockPrisma.vehicleCalendar.updateMany = async () => {
        releasedCalendar = true;
        return { count: 1 };
      };

      mockPrisma.bookingEvent.create = async (args: any) => {
        recordedEvent = args.data;
        return { id: 'evt-completed', ...args.data };
      };

      mockPrisma.notification.create = async (args: any) => {
        recordedNotifs.push(args.data);
        return { id: `notif-${recordedNotifs.length}`, ...args.data };
      };

      const result = await service.completeBooking('b-1', ACTOR_RENTER);
      assert.equal(result.status, 'COMPLETED');
      assert.equal(releasedCalendar, true);
      assert.equal(recordedEvent.eventType, 'TRIP_COMPLETED');
      assert.equal(recordedEvent.fromStatus, 'IN_PROGRESS');
      assert.equal(recordedEvent.toStatus, 'COMPLETED');
      assert.equal(recordedNotifs.length, 2);
      const recipientIds = recordedNotifs.map((n) => n.userId);
      assert.ok(recipientIds.includes(ACTOR_OWNER));
      assert.ok(recipientIds.includes(ACTOR_RENTER));
    });
  });
});
