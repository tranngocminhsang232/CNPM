import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter, TransformInterceptor } from '../src/common';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  BookingStatus,
  InspectionAngle,
  InspectionType,
  KeylessAction,
  KeylessOperationStatus,
  MediaPurpose,
  MediaState,
} from '@prisma/client';

describe('Keyless API (e2e) - G4-02 Virtual Keyless & Hardware Simulator', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let renter1Cookies: string[];
  let renter1Csrf: string;
  let renter1Id: string;

  let owner1Cookies: string[];

  let renter2Cookies: string[];
  let renter2Csrf: string;

  let testBookingId: string;
  let keylessVehicleId: string;
  let owner1Id: string;

  let frontMediaId: string;
  let rearMediaId: string;
  let leftMediaId: string;
  let rightMediaId: string;

  let unknownOpId: string;
  let successUnlockIdempotencyKey: string;

  before(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();
    prisma = app.get(PrismaService);

    // 1. Login renter1
    const renter1Login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'renter1@carsharing.local',
        password: 'DemoPassword123!',
      })
      .expect(200);

    renter1Id = renter1Login.body.data.user.id;
    renter1Csrf = renter1Login.body.data.csrfToken;
    renter1Cookies = (renter1Login.headers['set-cookie'] as unknown as string[]).map(
      (c) => (c.split(';')[0] as string) || c,
    );

    // 2. Login owner1
    const owner1Login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'owner1@carsharing.local',
        password: 'DemoPassword123!',
      })
      .expect(200);

    owner1Id = owner1Login.body.data.user.id;
    owner1Cookies = (owner1Login.headers['set-cookie'] as unknown as string[]).map(
      (c) => (c.split(';')[0] as string) || c,
    );

    // 3. Login renter2 (stranger)
    const renter2Login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'renter2@carsharing.local',
        password: 'DemoPassword123!',
      })
      .expect(200);

    renter2Csrf = renter2Login.body.data.csrfToken;
    renter2Cookies = (renter2Login.headers['set-cookie'] as unknown as string[]).map(
      (c) => (c.split(';')[0] as string) || c,
    );

    // 4. Find keyless vehicle (VinFast VF8 - 51K-10001)
    const vehicle = await prisma.vehicle.findFirstOrThrow({
      where: { plateNormalized: '51K-10001', keylessSupported: true },
    });
    keylessVehicleId = vehicle.id;

    // 5. Create dedicated active test booking
    const now = new Date();
    const startAt = new Date(now.getTime() - 10 * 60 * 1000); // 10m ago (within rental window)
    const endAt = new Date(now.getTime() + 4 * 3600 * 1000); // 4h later

    testBookingId = randomUUID();
    await prisma.booking.create({
      data: {
        id: testBookingId,
        vehicleId: keylessVehicleId,
        renterId: renter1Id,
        ownerId: owner1Id,
        startAt,
        endAt,
        status: BookingStatus.APPROVED,
        requestExpiresAt: new Date(startAt.getTime() - 3600 * 1000),
      },
    });

    // 6. Create verified media objects for inspection photos
    frontMediaId = randomUUID();
    rearMediaId = randomUUID();
    leftMediaId = randomUUID();
    rightMediaId = randomUUID();

    const mediaList = [frontMediaId, rearMediaId, leftMediaId, rightMediaId];
    for (const mId of mediaList) {
      await prisma.mediaObject.create({
        data: {
          id: mId,
          uploaderId: renter1Id,
          purpose: MediaPurpose.VEHICLE_PHOTO,
          stagingKey: `staging/${mId}.jpg`,
          finalKey: `inspections/${mId}.jpg`,
          mimeType: 'image/jpeg',
          sizeBytes: 102400,
          checksum: 'mock-sha256-checksum',
          state: MediaState.VERIFIED,
          verifiedAt: new Date(),
        },
      });
    }
  });

  after(async () => {
    // Cleanup created test records
    await prisma.keylessOperation.deleteMany({ where: { bookingId: testBookingId } });
    await prisma.inspectionPhoto.deleteMany({
      where: { mediaId: { in: [frontMediaId, rearMediaId, leftMediaId, rightMediaId] } },
    });
    await prisma.inspection.deleteMany({ where: { bookingId: testBookingId } });
    await prisma.bookingEvent.deleteMany({ where: { bookingId: testBookingId } });
    await prisma.notification.deleteMany({ where: { bookingId: testBookingId } });
    await prisma.booking.deleteMany({ where: { id: testBookingId } });
    await prisma.mediaObject.deleteMany({
      where: { id: { in: [frontMediaId, rearMediaId, leftMediaId, rightMediaId] } },
    });
    await app.close();
  });

  it('1. POST /api/v1/bookings/:id/keyless-operations rejects unauthenticated (401)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/bookings/${testBookingId}/keyless-operations`)
      .send({ action: KeylessAction.UNLOCK })
      .expect(401);
  });

  it('2. POST /api/v1/bookings/:id/keyless-operations rejects missing CSRF token (403)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/bookings/${testBookingId}/keyless-operations`)
      .set('Cookie', renter1Cookies)
      .send({ action: KeylessAction.UNLOCK })
      .expect(403);
  });

  it('3. POST /api/v1/bookings/:id/keyless-operations rejects missing Idempotency-Key header (400)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/bookings/${testBookingId}/keyless-operations`)
      .set('Cookie', renter1Cookies)
      .set('X-CSRF-Token', renter1Csrf)
      .send({ action: KeylessAction.UNLOCK })
      .expect(400);
  });

  it('4. POST /api/v1/bookings/:id/keyless-operations rejects stranger / third-party user (403 FORBIDDEN)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${testBookingId}/keyless-operations`)
      .set('Cookie', renter2Cookies)
      .set('X-CSRF-Token', renter2Csrf)
      .set('Idempotency-Key', 'test-keyless-idem-stranger-01')
      .send({ action: KeylessAction.UNLOCK })
      .expect(403);

    assert.strictEqual(res.body.error?.code, 'FORBIDDEN');
    assert.ok(res.body.error?.message?.includes('Chỉ người thuê'));
  });

  it('5. POST /api/v1/bookings/:id/keyless-operations rejects when CHECK_IN inspection is not finalized (422)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${testBookingId}/keyless-operations`)
      .set('Cookie', renter1Cookies)
      .set('X-CSRF-Token', renter1Csrf)
      .set('Idempotency-Key', 'test-keyless-idem-checklist-incomplete-01')
      .send({ action: KeylessAction.UNLOCK })
      .expect(422);

    assert.strictEqual(res.body.error?.code, 'CHECKLIST_INCOMPLETE');
    assert.ok(res.body.error?.message?.includes('CHECK_IN'));
  });

  it('6. Completing & finalizing CHECK_IN inspection allows Keyless operations', async () => {
    // Save draft inspection with 4 angles
    await request(app.getHttpServer())
      .put(`/api/v1/bookings/${testBookingId}/inspections`)
      .set('Cookie', renter1Cookies)
      .set('X-CSRF-Token', renter1Csrf)
      .send({
        type: InspectionType.CHECK_IN,
        odometerKm: 15420,
        fuelPercent: 92,
        damageNotes: 'Xe sạch, không trầy xước',
        photos: [
          { angle: InspectionAngle.FRONT, mediaId: frontMediaId },
          { angle: InspectionAngle.REAR, mediaId: rearMediaId },
          { angle: InspectionAngle.LEFT, mediaId: leftMediaId },
          { angle: InspectionAngle.RIGHT, mediaId: rightMediaId },
        ],
      })
      .expect(200);

    // Finalize inspection
    const finRes = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${testBookingId}/inspections/CHECK_IN/finalize`)
      .set('Cookie', renter1Cookies)
      .set('X-CSRF-Token', renter1Csrf)
      .expect(200);

    assert.strictEqual(finRes.body.data.acknowledged, true);
    assert.ok(finRes.body.data.finalizedAt);
  });

  it('7. POST /api/v1/bookings/:id/keyless-operations with simulateResult=UNKNOWN leaves booking in APPROVED (200)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${testBookingId}/keyless-operations`)
      .set('Cookie', renter1Cookies)
      .set('X-CSRF-Token', renter1Csrf)
      .set('Idempotency-Key', 'test-keyless-idem-timeout-sim-01')
      .send({
        action: KeylessAction.UNLOCK,
        simulateResult: 'UNKNOWN',
      })
      .expect(200);

    assert.strictEqual(res.body.data.status, KeylessOperationStatus.UNKNOWN);
    assert.strictEqual(res.body.data.bookingStatus, BookingStatus.APPROVED);
    unknownOpId = res.body.data.id;

    // Verify booking is still APPROVED in DB (not falsely transitioned to IN_PROGRESS on timeout)
    const b = await prisma.booking.findUniqueOrThrow({ where: { id: testBookingId } });
    assert.strictEqual(b.status, BookingStatus.APPROVED);
  });

  it('8. POST /api/v1/bookings/:id/keyless-operations rejects new operation when previous is UNRESOLVED (409)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${testBookingId}/keyless-operations`)
      .set('Cookie', renter1Cookies)
      .set('X-CSRF-Token', renter1Csrf)
      .set('Idempotency-Key', 'test-keyless-idem-blocked-by-unresolved-02')
      .send({ action: KeylessAction.UNLOCK })
      .expect(409);

    assert.strictEqual(res.body.error?.code, 'UNRESOLVED_OPERATION');
  });

  it('9. POST /api/v1/bookings/:id/keyless-operations/:opId/reconcile reconciles UNKNOWN operation and transitions booking to IN_PROGRESS (200)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${testBookingId}/keyless-operations/${unknownOpId}/reconcile`)
      .set('Cookie', renter1Cookies)
      .set('X-CSRF-Token', renter1Csrf)
      .expect(200);

    assert.strictEqual(res.body.data.status, KeylessOperationStatus.SUCCESS);
    assert.strictEqual(res.body.data.bookingStatus, BookingStatus.IN_PROGRESS);

    // Verify DB booking status
    const b = await prisma.booking.findUniqueOrThrow({ where: { id: testBookingId } });
    assert.strictEqual(b.status, BookingStatus.IN_PROGRESS);

    // Verify TRIP_STARTED event was emitted
    const evt = await prisma.bookingEvent.findFirst({
      where: { bookingId: testBookingId, eventType: 'TRIP_STARTED' },
    });
    assert.ok(evt);

    // Verify notification was sent to owner
    const notif = await prisma.notification.findFirst({
      where: { bookingId: testBookingId, type: 'TRIP_STARTED' },
    });
    assert.ok(notif);
    assert.strictEqual(notif?.userId, owner1Id);
  });

  it('10. POST /api/v1/bookings/:id/keyless-operations executes LOCK successfully on IN_PROGRESS booking (200)', async () => {
    successUnlockIdempotencyKey = 'test-keyless-idem-lock-success-03';
    const res = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${testBookingId}/keyless-operations`)
      .set('Cookie', renter1Cookies)
      .set('X-CSRF-Token', renter1Csrf)
      .set('Idempotency-Key', successUnlockIdempotencyKey)
      .send({ action: KeylessAction.LOCK })
      .expect(200);

    assert.strictEqual(res.body.data.action, KeylessAction.LOCK);
    assert.strictEqual(res.body.data.status, KeylessOperationStatus.SUCCESS);
    assert.strictEqual(res.body.data.bookingStatus, BookingStatus.IN_PROGRESS);
  });

  it('11. Idempotency replay with same key returns existing operation (isReplay: true)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${testBookingId}/keyless-operations`)
      .set('Cookie', renter1Cookies)
      .set('X-CSRF-Token', renter1Csrf)
      .set('Idempotency-Key', successUnlockIdempotencyKey)
      .send({ action: KeylessAction.LOCK })
      .expect(200);

    assert.strictEqual(res.body.data.isReplay, true);
    assert.strictEqual(res.body.data.action, KeylessAction.LOCK);
  });

  it('12. Reusing same Idempotency-Key with different payload rejects 409 IDEMPOTENCY_MISMATCH', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${testBookingId}/keyless-operations`)
      .set('Cookie', renter1Cookies)
      .set('X-CSRF-Token', renter1Csrf)
      .set('Idempotency-Key', successUnlockIdempotencyKey)
      .send({ action: KeylessAction.UNLOCK }) // Changed from LOCK to UNLOCK
      .expect(409);

    assert.strictEqual(res.body.error?.code, 'IDEMPOTENCY_MISMATCH');
  });

  it('13. GET /api/v1/bookings/:id/keyless-operations/:opId returns details to renter and owner (200)', async () => {
    // Renter views operation
    const renterRes = await request(app.getHttpServer())
      .get(`/api/v1/bookings/${testBookingId}/keyless-operations/${unknownOpId}`)
      .set('Cookie', renter1Cookies)
      .expect(200);

    assert.strictEqual(renterRes.body.data.id, unknownOpId);
    assert.strictEqual(renterRes.body.data.status, KeylessOperationStatus.SUCCESS);

    // Owner views operation
    const ownerRes = await request(app.getHttpServer())
      .get(`/api/v1/bookings/${testBookingId}/keyless-operations/${unknownOpId}`)
      .set('Cookie', owner1Cookies)
      .expect(200);

    assert.strictEqual(ownerRes.body.data.id, unknownOpId);

    // Stranger rejects 403
    await request(app.getHttpServer())
      .get(`/api/v1/bookings/${testBookingId}/keyless-operations/${unknownOpId}`)
      .set('Cookie', renter2Cookies)
      .expect(403);
  });
});
