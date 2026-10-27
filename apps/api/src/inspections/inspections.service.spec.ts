import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InspectionsService } from './inspections.service';
import {
  InspectionType,
  InspectionAngle,
  BookingStatus,
  MediaState,
  MediaPurpose,
} from '@prisma/client';

describe('InspectionsService (Unit)', () => {
  let service: InspectionsService;
  let mockPrisma: any;
  let mockMediaService: any;

  const renterId = '00000000-0000-0000-0000-000000000003';
  const ownerId = '00000000-0000-0000-0000-000000000001';
  const strangerId = '00000000-0000-0000-0000-000000000004';
  const bookingId = '20000000-0000-0000-0000-000000000003';
  const mediaIdFront = '60000000-0000-0000-0000-000000000001';
  const mediaIdRear = '60000000-0000-0000-0000-000000000002';
  const mediaIdLeft = '60000000-0000-0000-0000-000000000003';
  const mediaIdRight = '60000000-0000-0000-0000-000000000004';

  const mockApprovedBooking = {
    id: bookingId,
    renterId,
    ownerId,
    status: BookingStatus.APPROVED,
    vehicleId: '10000000-0000-0000-0000-000000000001',
  };

  beforeEach(() => {
    mockPrisma = {
      booking: {
        findUnique: (args: any) => {
          if (args.where.id === bookingId) return Promise.resolve(mockApprovedBooking);
          return Promise.resolve(null);
        },
      },
      inspection: {
        findUnique: (_args: any) => Promise.resolve(null),
        findMany: (_args: any) => Promise.resolve([]),
        upsert: (args: any) =>
          Promise.resolve({
            id: 'insp-123',
            bookingId,
            type: args.create.type,
            odometerKm: args.create.odometerKm,
            fuelPercent: args.create.fuelPercent,
            damageNotes: args.create.damageNotes,
            acknowledged: false,
            finalizedAt: null,
            version: args.create.version,
            performedBy: args.create.performedBy,
            createdAt: new Date(),
          }),
        findUniqueOrThrow: (_args: any) =>
          Promise.resolve({
            id: 'insp-123',
            bookingId,
            type: InspectionType.CHECK_IN,
            odometerKm: 12500,
            fuelPercent: 95,
            damageNotes: 'Trầy nhẹ cản sau',
            acknowledged: false,
            finalizedAt: null,
            version: 1,
            performedBy: renterId,
            createdAt: new Date(),
            photos: [
              { inspectionId: 'insp-123', angle: InspectionAngle.FRONT, mediaId: mediaIdFront },
            ],
          }),
        update: (args: any) =>
          Promise.resolve({
            id: args.where.id,
            bookingId,
            type: InspectionType.CHECK_IN,
            odometerKm: 12500,
            fuelPercent: 95,
            damageNotes: null,
            acknowledged: true,
            finalizedAt: args.data.finalizedAt,
            version: args.data.version,
            performedBy: renterId,
            createdAt: new Date(),
            photos: [],
          }),
      },
      inspectionPhoto: {
        deleteMany: () => Promise.resolve({ count: 1 }),
        createMany: () => Promise.resolve({ count: 1 }),
      },
      mediaObject: {
        findUnique: (args: any) =>
          Promise.resolve({
            id: args.where.id,
            purpose: MediaPurpose.INSPECTION_PHOTO,
            state: MediaState.VERIFIED,
          }),
      },
      bookingEvent: {
        create: (args: any) => Promise.resolve(args.data),
      },
      notification: {
        create: (args: any) => Promise.resolve(args.data),
      },
      $transaction: (fn: any) => fn(mockPrisma),
    };

    mockMediaService = {
      getReadUrl: (mediaId: string) =>
        Promise.resolve({
          url: `https://storage.carsharing.local/inspection/${mediaId}.jpg`,
          mediaId,
        }),
    };

    service = new InspectionsService(mockPrisma, mockMediaService);
  });

  it('1. should throw NotFoundException if booking does not exist', async () => {
    await assert.rejects(
      () =>
        service.saveInspection('invalid-booking', renterId, {
          type: InspectionType.CHECK_IN,
          odometerKm: 10000,
          fuelPercent: 100,
          photos: [],
        }),
      NotFoundException,
    );
  });

  it('2. should throw ForbiddenException if requester is stranger', async () => {
    await assert.rejects(
      () =>
        service.saveInspection(bookingId, strangerId, {
          type: InspectionType.CHECK_IN,
          odometerKm: 10000,
          fuelPercent: 100,
          photos: [],
        }),
      ForbiddenException,
    );
  });

  it('3. should throw BadRequestException if CHECK_OUT attempted while booking is only APPROVED', async () => {
    await assert.rejects(
      () =>
        service.saveInspection(bookingId, renterId, {
          type: InspectionType.CHECK_OUT,
          odometerKm: 10000,
          fuelPercent: 100,
          photos: [],
        }),
      BadRequestException,
    );
  });

  it('4. should throw ConflictException if inspection is already finalized', async () => {
    mockPrisma.inspection.findUnique = () =>
      Promise.resolve({
        id: 'insp-final',
        bookingId,
        type: InspectionType.CHECK_IN,
        finalizedAt: new Date(),
        version: 1,
      });

    await assert.rejects(
      () =>
        service.saveInspection(bookingId, renterId, {
          type: InspectionType.CHECK_IN,
          odometerKm: 10000,
          fuelPercent: 100,
          photos: [],
        }),
      ConflictException,
    );
  });

  it('5. should throw ConflictException on version concurrency conflict', async () => {
    mockPrisma.inspection.findUnique = () =>
      Promise.resolve({
        id: 'insp-1',
        bookingId,
        type: InspectionType.CHECK_IN,
        finalizedAt: null,
        version: 2, // Current version is 2
      });

    await assert.rejects(
      () =>
        service.saveInspection(bookingId, renterId, {
          type: InspectionType.CHECK_IN,
          odometerKm: 10000,
          fuelPercent: 100,
          version: 1, // Client sent stale version 1
          photos: [],
        }),
      ConflictException,
    );
  });

  it('6. should throw BadRequestException if photo media is unverified', async () => {
    mockPrisma.mediaObject.findUnique = () =>
      Promise.resolve({
        id: 'unverified-media',
        state: MediaState.STAGING, // NOT VERIFIED
      });

    await assert.rejects(
      () =>
        service.saveInspection(bookingId, renterId, {
          type: InspectionType.CHECK_IN,
          odometerKm: 10000,
          fuelPercent: 100,
          photos: [{ angle: InspectionAngle.FRONT, mediaId: 'unverified-media' }],
        }),
      BadRequestException,
    );
  });

  it('7. should save inspection draft successfully and return response DTO', async () => {
    const res = await service.saveInspection(bookingId, renterId, {
      type: InspectionType.CHECK_IN,
      odometerKm: 12500,
      fuelPercent: 95,
      damageNotes: 'Trầy nhẹ cản sau',
      photos: [{ angle: InspectionAngle.FRONT, mediaId: mediaIdFront }],
    });

    assert.strictEqual(res.bookingId, bookingId);
    assert.strictEqual(res.type, InspectionType.CHECK_IN);
    assert.strictEqual(res.odometerKm, 12500);
    assert.strictEqual(res.fuelPercent, 95);
    assert.strictEqual(res.photos.length, 1);
    const firstPhoto = res.photos[0]!;
    assert.strictEqual(firstPhoto.angle, InspectionAngle.FRONT);
    assert.ok(firstPhoto.readUrl?.includes(mediaIdFront));
  });

  it('8. should throw UnprocessableEntityException when finalizing with missing angles', async () => {
    mockPrisma.inspection.findUnique = () =>
      Promise.resolve({
        id: 'insp-partial',
        bookingId,
        type: InspectionType.CHECK_IN,
        finalizedAt: null,
        version: 1,
        photos: [
          { angle: InspectionAngle.FRONT, mediaId: mediaIdFront },
          // Missing REAR, LEFT, RIGHT!
        ],
      });

    await assert.rejects(
      () => service.finalizeInspection(bookingId, renterId, InspectionType.CHECK_IN),
      (err: any) => {
        assert.ok(err instanceof UnprocessableEntityException);
        assert.ok(err.message.includes('REAR'));
        assert.ok(err.message.includes('LEFT'));
        assert.ok(err.message.includes('RIGHT'));
        return true;
      },
    );
  });

  it('9. should finalize inspection when all 4 angles are present', async () => {
    mockPrisma.inspection.findUnique = () =>
      Promise.resolve({
        id: 'insp-complete',
        bookingId,
        type: InspectionType.CHECK_IN,
        finalizedAt: null,
        version: 1,
        odometerKm: 12500,
        fuelPercent: 100,
        photos: [
          { angle: InspectionAngle.FRONT, mediaId: mediaIdFront },
          { angle: InspectionAngle.REAR, mediaId: mediaIdRear },
          { angle: InspectionAngle.LEFT, mediaId: mediaIdLeft },
          { angle: InspectionAngle.RIGHT, mediaId: mediaIdRight },
        ],
      });

    mockPrisma.inspection.update = (args: any) =>
      Promise.resolve({
        id: 'insp-complete',
        bookingId,
        type: InspectionType.CHECK_IN,
        odometerKm: 12500,
        fuelPercent: 100,
        damageNotes: null,
        acknowledged: true,
        finalizedAt: args.data.finalizedAt,
        version: 2,
        performedBy: renterId,
        createdAt: new Date(),
        photos: [
          { angle: InspectionAngle.FRONT, mediaId: mediaIdFront },
          { angle: InspectionAngle.REAR, mediaId: mediaIdRear },
          { angle: InspectionAngle.LEFT, mediaId: mediaIdLeft },
          { angle: InspectionAngle.RIGHT, mediaId: mediaIdRight },
        ],
      });

    const res = await service.finalizeInspection(bookingId, renterId, InspectionType.CHECK_IN);
    assert.strictEqual(res.acknowledged, true);
    assert.ok(res.finalizedAt);
    assert.strictEqual(res.version, 2);
  });

  it('10. should return existing inspection idempotently if already finalized', async () => {
    const existingDate = new Date('2026-10-27T10:00:00Z');
    mockPrisma.inspection.findUnique = () =>
      Promise.resolve({
        id: 'insp-already-done',
        bookingId,
        type: InspectionType.CHECK_IN,
        finalizedAt: existingDate,
        acknowledged: true,
        version: 2,
        odometerKm: 12500,
        fuelPercent: 100,
        damageNotes: null,
        performedBy: renterId,
        createdAt: new Date(),
        photos: [],
      });

    const res = await service.finalizeInspection(bookingId, renterId, InspectionType.CHECK_IN);
    assert.strictEqual(res.acknowledged, true);
    assert.strictEqual(res.finalizedAt, existingDate);
  });

  it('11. should reject saveDraft for CHECK_OUT when odometerKm < checkIn.odometerKm (BR-10)', async () => {
    // Set booking to IN_PROGRESS
    mockPrisma.booking.findUnique = () =>
      Promise.resolve({
        id: bookingId,
        renterId,
        ownerId,
        status: BookingStatus.IN_PROGRESS,
      });

    // Existing CHECK_IN inspection has odo = 15000
    mockPrisma.inspection.findUnique = (args: any) => {
      if (args.where?.bookingId_type?.type === InspectionType.CHECK_IN) {
        return Promise.resolve({
          id: 'insp-checkin',
          bookingId,
          type: InspectionType.CHECK_IN,
          odometerKm: 15000,
        });
      }
      return Promise.resolve(null);
    };

    await assert.rejects(
      () =>
        service.saveInspection(bookingId, renterId, {
          type: InspectionType.CHECK_OUT,
          odometerKm: 14500, // nhỏ hơn 15000
          fuelPercent: 85,
          photos: [],
          version: 1,
        }),
      (err: any) => {
        assert.ok(err instanceof BadRequestException);
        assert.ok(err.message.includes('không được nhỏ hơn số km lúc nhận xe'));
        return true;
      },
    );
  });

  it('12. should reject finalizeInspection for CHECK_OUT when odometerKm < checkIn.odometerKm (BR-10)', async () => {
    mockPrisma.booking.findUnique = () =>
      Promise.resolve({
        id: bookingId,
        renterId,
        ownerId,
        status: BookingStatus.IN_PROGRESS,
      });

    mockPrisma.inspection.findUnique = (args: any) => {
      if (args.where?.bookingId_type?.type === InspectionType.CHECK_OUT) {
        return Promise.resolve({
          id: 'insp-checkout',
          bookingId,
          type: InspectionType.CHECK_OUT,
          finalizedAt: null,
          version: 1,
          odometerKm: 14000, // nhỏ hơn CHECK_IN 15000
          fuelPercent: 80,
          photos: [
            { angle: InspectionAngle.FRONT, mediaId: mediaIdFront },
            { angle: InspectionAngle.REAR, mediaId: mediaIdRear },
            { angle: InspectionAngle.LEFT, mediaId: mediaIdLeft },
            { angle: InspectionAngle.RIGHT, mediaId: mediaIdRight },
          ],
        });
      }
      if (args.where?.bookingId_type?.type === InspectionType.CHECK_IN) {
        return Promise.resolve({
          id: 'insp-checkin',
          bookingId,
          type: InspectionType.CHECK_IN,
          odometerKm: 15000,
        });
      }
      return Promise.resolve(null);
    };

    await assert.rejects(
      () => service.finalizeInspection(bookingId, renterId, InspectionType.CHECK_OUT),
      (err: any) => {
        assert.ok(err instanceof UnprocessableEntityException);
        assert.ok(err.message.includes('không được nhỏ hơn số km lúc nhận xe'));
        return true;
      },
    );
  });
});
