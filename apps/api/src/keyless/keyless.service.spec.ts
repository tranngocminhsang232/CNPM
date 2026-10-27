import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { KeylessService, computeKeylessHash } from './keyless.service';
import { KeylessSimulatorAdapter } from './adapters/keyless-simulator.adapter';
import {
  BookingStatus,
  InspectionType,
  KeylessAction,
  KeylessOperationStatus,
} from '@prisma/client';

describe('KeylessService (Unit) - G4-02', () => {
  let service: KeylessService;
  let mockPrisma: any;
  let simulator: KeylessSimulatorAdapter;

  const validIdempotencyKey = 'keyless-idem-key-1234567890';
  const renterId = '10000000-0000-0000-0000-000000000001';
  const ownerId = '10000000-0000-0000-0000-000000000002';
  const strangerId = '10000000-0000-0000-0000-000000000099';
  const bookingId = '20000000-0000-0000-0000-000000000003';
  const vehicleId = '30000000-0000-0000-0000-000000000001';

  const now = new Date();
  const validStartAt = new Date(now.getTime() - 5 * 60 * 1000); // 5 phút trước
  const validEndAt = new Date(now.getTime() + 2 * 3600 * 1000); // 2 giờ tới

  beforeEach(() => {
    simulator = new KeylessSimulatorAdapter();

    mockPrisma = {
      keylessOperation: {
        findUnique: () => Promise.resolve(null),
        findFirst: () => Promise.resolve(null),
        create: (args: any) =>
          Promise.resolve({
            id: '50000000-0000-0000-0000-000000000001',
            ...args.data,
            createdAt: new Date(),
            resolvedAt: null,
            deviceResult: null,
          }),
        update: (args: any) =>
          Promise.resolve({
            id: args.where.id,
            ...args.data,
          }),
        findUniqueOrThrow: () =>
          Promise.resolve({
            id: '50000000-0000-0000-0000-000000000001',
            bookingId,
            actorId: renterId,
            action: KeylessAction.UNLOCK,
            idempotencyKey: validIdempotencyKey,
            status: KeylessOperationStatus.SUCCESS,
            provider: 'SIMULATOR',
            deviceResult: '{"doors":"UNLOCKED"}',
            resolvedAt: new Date(),
            createdAt: new Date(),
          }),
      },
      booking: {
        findUnique: () =>
          Promise.resolve({
            id: bookingId,
            renterId,
            ownerId,
            vehicleId,
            startAt: validStartAt,
            endAt: validEndAt,
            status: BookingStatus.APPROVED,
            vehicle: {
              id: vehicleId,
              plateNormalized: '51K-10001',
              keylessSupported: true,
            },
            inspections: [
              {
                type: InspectionType.CHECK_IN,
                acknowledged: true,
                finalizedAt: new Date(),
              },
            ],
          }),
        update: () => Promise.resolve({ id: bookingId, status: BookingStatus.IN_PROGRESS }),
      },
      bookingEvent: {
        create: () => Promise.resolve({ id: 'evt-1' }),
      },
      notification: {
        create: () => Promise.resolve({ id: 'notif-1' }),
      },
      $transaction: async (cb: any) => cb(mockPrisma),
    };

    service = new KeylessService(mockPrisma, simulator);
  });

  describe('computeKeylessHash', () => {
    it('produces deterministic sha256 regardless of case', () => {
      const h1 = computeKeylessHash({
        bookingId: '20000000-0000-0000-0000-000000000003',
        actorId: '10000000-0000-0000-0000-000000000001',
        action: KeylessAction.UNLOCK,
      });
      const h2 = computeKeylessHash({
        bookingId: '20000000-0000-0000-0000-000000000003'.toUpperCase(),
        actorId: '10000000-0000-0000-0000-000000000001'.toUpperCase(),
        action: KeylessAction.UNLOCK,
      });
      assert.strictEqual(h1, h2);
      assert.strictEqual(h1.length, 64);
    });
  });

  describe('triggerOperation validation', () => {
    it('1. rejects invalid Idempotency-Key (< 16 chars) with 400', async () => {
      await assert.rejects(
        () =>
          service.triggerOperation(bookingId, renterId, { action: KeylessAction.UNLOCK }, 'short'),
        (err: any) => {
          assert.ok(err instanceof BadRequestException);
          assert.strictEqual((err.getResponse() as any).code, 'VALIDATION_ERROR');
          return true;
        },
      );
    });

    it('2. replays existing operation when Idempotency-Key matches (isReplay: true)', async () => {
      const expectedHash = computeKeylessHash({
        bookingId,
        actorId: renterId,
        action: KeylessAction.UNLOCK,
      });

      mockPrisma.keylessOperation.findFirst = (args: any) => {
        if (args?.where?.idempotencyKey) {
          return Promise.resolve({
            id: 'op-existing-1',
            bookingId,
            actorId: renterId,
            action: KeylessAction.UNLOCK,
            idempotencyKey: validIdempotencyKey,
            requestHash: expectedHash,
            status: KeylessOperationStatus.SUCCESS,
            provider: 'SIMULATOR',
            deviceResult: '{"doors":"UNLOCKED"}',
            resolvedAt: new Date(),
            createdAt: new Date(),
            booking: { status: BookingStatus.IN_PROGRESS },
          });
        }
        return Promise.resolve(null);
      };

      const res = await service.triggerOperation(
        bookingId,
        renterId,
        { action: KeylessAction.UNLOCK },
        validIdempotencyKey,
      );

      assert.strictEqual(res.isReplay, true);
      assert.strictEqual(res.id, 'op-existing-1');
      assert.strictEqual(res.bookingStatus, BookingStatus.IN_PROGRESS);
    });

    it('3. rejects 409 IDEMPOTENCY_MISMATCH when same key is reused with different action', async () => {
      mockPrisma.keylessOperation.findFirst = (args: any) => {
        if (args?.where?.idempotencyKey) {
          return Promise.resolve({
            id: 'op-existing-1',
            bookingId,
            actorId: renterId,
            action: KeylessAction.UNLOCK,
            idempotencyKey: validIdempotencyKey,
            requestHash: 'different-hash',
            status: KeylessOperationStatus.SUCCESS,
            provider: 'SIMULATOR',
            booking: { status: BookingStatus.IN_PROGRESS },
          });
        }
        return Promise.resolve(null);
      };

      await assert.rejects(
        () =>
          service.triggerOperation(
            bookingId,
            renterId,
            { action: KeylessAction.UNLOCK },
            validIdempotencyKey,
          ),
        (err: any) => {
          assert.ok(err instanceof ConflictException);
          assert.strictEqual((err.getResponse() as any).code, 'IDEMPOTENCY_MISMATCH');
          return true;
        },
      );
    });

    it('4. rejects 404 if booking is not found', async () => {
      mockPrisma.booking.findUnique = () => Promise.resolve(null);

      await assert.rejects(
        () =>
          service.triggerOperation(
            bookingId,
            renterId,
            { action: KeylessAction.UNLOCK },
            validIdempotencyKey,
          ),
        (err: any) => {
          assert.ok(err instanceof NotFoundException);
          return true;
        },
      );
    });

    it('5. rejects 403 FORBIDDEN if requester is not the renter', async () => {
      await assert.rejects(
        () =>
          service.triggerOperation(
            bookingId,
            strangerId,
            { action: KeylessAction.UNLOCK },
            validIdempotencyKey,
          ),
        (err: any) => {
          assert.ok(err instanceof ForbiddenException);
          assert.strictEqual((err.getResponse() as any).code, 'FORBIDDEN');
          return true;
        },
      );
    });

    it('6. rejects 422 KEYLESS_NOT_SUPPORTED if vehicle does not support Keyless', async () => {
      mockPrisma.booking.findUnique = () =>
        Promise.resolve({
          id: bookingId,
          renterId,
          ownerId,
          vehicleId,
          startAt: validStartAt,
          endAt: validEndAt,
          status: BookingStatus.APPROVED,
          vehicle: {
            id: vehicleId,
            plateNormalized: '51K-10001',
            keylessSupported: false, // Vehicle has no keyless
          },
          inspections: [],
        });

      await assert.rejects(
        () =>
          service.triggerOperation(
            bookingId,
            renterId,
            { action: KeylessAction.UNLOCK },
            validIdempotencyKey,
          ),
        (err: any) => {
          assert.ok(err instanceof UnprocessableEntityException);
          assert.strictEqual((err.getResponse() as any).code, 'KEYLESS_NOT_SUPPORTED');
          return true;
        },
      );
    });

    it('7. rejects 409 INVALID_BOOKING_STATUS if booking status is REQUESTED or CANCELLED', async () => {
      mockPrisma.booking.findUnique = () =>
        Promise.resolve({
          id: bookingId,
          renterId,
          ownerId,
          vehicleId,
          startAt: validStartAt,
          endAt: validEndAt,
          status: BookingStatus.REQUESTED, // Still REQUESTED
          vehicle: { keylessSupported: true },
          inspections: [],
        });

      await assert.rejects(
        () =>
          service.triggerOperation(
            bookingId,
            renterId,
            { action: KeylessAction.UNLOCK },
            validIdempotencyKey,
          ),
        (err: any) => {
          assert.ok(err instanceof ConflictException);
          assert.strictEqual((err.getResponse() as any).code, 'INVALID_BOOKING_STATUS');
          return true;
        },
      );
    });

    it('8. rejects 422 OUTSIDE_RENTAL_PERIOD if current time is outside rental window', async () => {
      mockPrisma.booking.findUnique = () =>
        Promise.resolve({
          id: bookingId,
          renterId,
          ownerId,
          vehicleId,
          startAt: new Date(now.getTime() + 24 * 3600 * 1000), // Ngày mai mới tới giờ nhận
          endAt: new Date(now.getTime() + 48 * 3600 * 1000),
          status: BookingStatus.APPROVED,
          vehicle: { keylessSupported: true },
          inspections: [],
        });

      await assert.rejects(
        () =>
          service.triggerOperation(
            bookingId,
            renterId,
            { action: KeylessAction.UNLOCK },
            validIdempotencyKey,
          ),
        (err: any) => {
          assert.ok(err instanceof UnprocessableEntityException);
          assert.strictEqual((err.getResponse() as any).code, 'OUTSIDE_RENTAL_PERIOD');
          return true;
        },
      );
    });

    it('9. rejects 422 CHECKLIST_INCOMPLETE if CHECK_IN inspection is missing or not finalized', async () => {
      mockPrisma.booking.findUnique = () =>
        Promise.resolve({
          id: bookingId,
          renterId,
          ownerId,
          vehicleId,
          startAt: validStartAt,
          endAt: validEndAt,
          status: BookingStatus.APPROVED,
          vehicle: { keylessSupported: true, plateNormalized: '51K-10001' },
          inspections: [
            {
              type: InspectionType.CHECK_IN,
              acknowledged: false, // Draft only, not finalized
              finalizedAt: null,
            },
          ],
        });

      await assert.rejects(
        () =>
          service.triggerOperation(
            bookingId,
            renterId,
            { action: KeylessAction.UNLOCK },
            validIdempotencyKey,
          ),
        (err: any) => {
          assert.ok(err instanceof UnprocessableEntityException);
          assert.strictEqual((err.getResponse() as any).code, 'CHECKLIST_INCOMPLETE');
          return true;
        },
      );
    });

    it('10. rejects 409 UNRESOLVED_OPERATION if a PENDING operation is already unresolved', async () => {
      mockPrisma.keylessOperation.findFirst = (args: any) => {
        if (args?.where?.idempotencyKey) return Promise.resolve(null);
        return Promise.resolve({
          id: 'op-pending-1',
          status: KeylessOperationStatus.PENDING,
        });
      };

      await assert.rejects(
        () =>
          service.triggerOperation(
            bookingId,
            renterId,
            { action: KeylessAction.UNLOCK },
            validIdempotencyKey,
          ),
        (err: any) => {
          assert.ok(err instanceof ConflictException);
          assert.strictEqual((err.getResponse() as any).code, 'UNRESOLVED_OPERATION');
          return true;
        },
      );
    });

    it('11. successfully executes UNLOCK, updates booking to IN_PROGRESS, and emits event', async () => {
      let bookingUpdatedStatus: BookingStatus | null = null;
      let eventTypeCreated: string | null = null;

      mockPrisma.booking.update = (args: any) => {
        bookingUpdatedStatus = args.data.status;
        return Promise.resolve({ id: bookingId, status: args.data.status });
      };

      mockPrisma.bookingEvent.create = (args: any) => {
        eventTypeCreated = args.data.eventType;
        return Promise.resolve({ id: 'event-123' });
      };

      const res = await service.triggerOperation(
        bookingId,
        renterId,
        { action: KeylessAction.UNLOCK },
        validIdempotencyKey,
      );

      assert.strictEqual(res.status, KeylessOperationStatus.SUCCESS);
      assert.strictEqual(res.action, KeylessAction.UNLOCK);
      assert.strictEqual(res.bookingStatus, BookingStatus.IN_PROGRESS);
      assert.strictEqual(bookingUpdatedStatus, BookingStatus.IN_PROGRESS);
      assert.strictEqual(eventTypeCreated, 'TRIP_STARTED');
    });

    it('12. getOperation rejects stranger (403) and allows renter (200)', async () => {
      mockPrisma.keylessOperation.findUnique = () =>
        Promise.resolve({
          id: 'op-1',
          bookingId,
          actorId: renterId,
          action: KeylessAction.UNLOCK,
          idempotencyKey: validIdempotencyKey,
          status: KeylessOperationStatus.SUCCESS,
          provider: 'SIMULATOR',
          booking: { renterId, ownerId, status: BookingStatus.IN_PROGRESS },
        });

      await assert.rejects(
        () => service.getOperation(bookingId, 'op-1', strangerId),
        (err: any) => {
          assert.ok(err instanceof ForbiddenException);
          return true;
        },
      );

      const op = await service.getOperation(bookingId, 'op-1', renterId);
      assert.strictEqual(op.id, 'op-1');
    });

    it('13. reconcileOperation reconciles UNKNOWN operation to SUCCESS', async () => {
      mockPrisma.keylessOperation.findUnique = () =>
        Promise.resolve({
          id: 'op-unknown-1',
          bookingId,
          actorId: renterId,
          action: KeylessAction.UNLOCK,
          idempotencyKey: validIdempotencyKey,
          status: KeylessOperationStatus.UNKNOWN,
          provider: 'SIMULATOR',
          booking: {
            renterId,
            ownerId,
            status: BookingStatus.APPROVED,
            vehicle: { plateNormalized: '51K-10001' },
          },
        });

      mockPrisma.keylessOperation.findUniqueOrThrow = () =>
        Promise.resolve({
          id: 'op-unknown-1',
          bookingId,
          actorId: renterId,
          action: KeylessAction.UNLOCK,
          idempotencyKey: validIdempotencyKey,
          status: KeylessOperationStatus.SUCCESS,
          provider: 'SIMULATOR',
          deviceResult: '{"reconciled":true}',
          resolvedAt: new Date(),
          createdAt: new Date(),
        });

      const res = await service.reconcileOperation(bookingId, 'op-unknown-1', renterId);
      assert.strictEqual(res.status, KeylessOperationStatus.SUCCESS);
      assert.strictEqual(res.bookingStatus, BookingStatus.IN_PROGRESS);
    });
  });
});
