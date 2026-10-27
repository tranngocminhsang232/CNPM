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

describe('Trip Completion & Return Inspection API (e2e) - G5-01', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let renter1Cookies: string[];
  let renter1Csrf: string;
  let renter1Id: string;

  let owner1Cookies: string[];
  let owner1Csrf: string;
  let owner1Id: string;

  let renter2Cookies: string[];
  let renter2Csrf: string;

  let testBookingId: string;
  let keylessVehicleId: string;

  // Media IDs for Check-In
  let inFrontMediaId: string;
  let inRearMediaId: string;
  let inLeftMediaId: string;
  let inRightMediaId: string;

  // Media IDs for Check-Out
  let outFrontMediaId: string;
  let outRearMediaId: string;
  let outLeftMediaId: string;
  let outRightMediaId: string;

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
    owner1Csrf = owner1Login.body.data.csrfToken;
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

    // 5. Create test booking
    const now = new Date();
    const startAt = new Date(now.getTime() - 2 * 3600 * 1000); // 2 hours ago
    const endAt = new Date(now.getTime() + 2 * 3600 * 1000); // 2 hours later

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

    // Create active vehicle calendar hold
    await prisma.vehicleCalendar.create({
      data: {
        vehicleId: keylessVehicleId,
        bookingId: testBookingId,
        startAt,
        endAt,
        kind: 'BOOKING',
      },
    });

    // 6. Create verified media objects for check-in and check-out
    inFrontMediaId = randomUUID();
    inRearMediaId = randomUUID();
    inLeftMediaId = randomUUID();
    inRightMediaId = randomUUID();
    outFrontMediaId = randomUUID();
    outRearMediaId = randomUUID();
    outLeftMediaId = randomUUID();
    outRightMediaId = randomUUID();

    const mediaList = [
      inFrontMediaId,
      inRearMediaId,
      inLeftMediaId,
      inRightMediaId,
      outFrontMediaId,
      outRearMediaId,
      outLeftMediaId,
      outRightMediaId,
    ];

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

    // 7. Seed finalized CHECK_IN inspection (odometer 12000 km, fuel 90%)
    await prisma.inspection.create({
      data: {
        id: randomUUID(),
        bookingId: testBookingId,
        type: InspectionType.CHECK_IN,
        odometerKm: 12000,
        fuelPercent: 90,
        acknowledged: true,
        finalizedAt: new Date(),
        version: 1,
        performedBy: renter1Id,
        photos: {
          create: [
            { angle: InspectionAngle.FRONT, mediaId: inFrontMediaId },
            { angle: InspectionAngle.REAR, mediaId: inRearMediaId },
            { angle: InspectionAngle.LEFT, mediaId: inLeftMediaId },
            { angle: InspectionAngle.RIGHT, mediaId: inRightMediaId },
          ],
        },
      },
    });
  });

  after(async () => {
    // Cleanup
    await prisma.keylessOperation.deleteMany({ where: { bookingId: testBookingId } });
    await prisma.inspectionPhoto.deleteMany({
      where: {
        mediaId: {
          in: [
            inFrontMediaId,
            inRearMediaId,
            inLeftMediaId,
            inRightMediaId,
            outFrontMediaId,
            outRearMediaId,
            outLeftMediaId,
            outRightMediaId,
          ],
        },
      },
    });
    await prisma.inspection.deleteMany({ where: { bookingId: testBookingId } });
    await prisma.notification.deleteMany({ where: { bookingId: testBookingId } });
    await prisma.bookingEvent.deleteMany({ where: { bookingId: testBookingId } });
    await prisma.vehicleCalendar.deleteMany({ where: { bookingId: testBookingId } });
    await prisma.booking.deleteMany({ where: { id: testBookingId } });
    await prisma.mediaObject.deleteMany({
      where: {
        id: {
          in: [
            inFrontMediaId,
            inRearMediaId,
            inLeftMediaId,
            inRightMediaId,
            outFrontMediaId,
            outRearMediaId,
            outLeftMediaId,
            outRightMediaId,
          ],
        },
      },
    });
    await app.close();
  });

  it('1. POST /api/v1/bookings/:id/complete rejects unauthenticated (401)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/bookings/${testBookingId}/complete`)
      .expect(401);
  });

  it('2. POST /api/v1/bookings/:id/complete rejects stranger (403 FORBIDDEN)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${testBookingId}/complete`)
      .set('Cookie', renter2Cookies)
      .set('x-csrf-token', renter2Csrf)
      .expect(403);

    assert.equal(res.body.error?.code, 'FORBIDDEN');
  });

  it('2b. POST /api/v1/bookings/:id/complete rejects owner attempting to complete (403 FORBIDDEN)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${testBookingId}/complete`)
      .set('Cookie', owner1Cookies)
      .set('x-csrf-token', owner1Csrf)
      .expect(403);

    assert.equal(res.body.error?.code, 'FORBIDDEN');
  });

  it('3. POST /api/v1/bookings/:id/complete rejects 409 INVALID_TRANSITION when status is APPROVED', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${testBookingId}/complete`)
      .set('Cookie', renter1Cookies)
      .set('x-csrf-token', renter1Csrf)
      .expect(409);

    assert.equal(res.body.error?.code, 'INVALID_TRANSITION');
  });

  it('4. POST /api/v1/bookings/:id/complete rejects 422 CHECKLIST_INCOMPLETE when status is IN_PROGRESS but CHECK_OUT missing', async () => {
    // Transition to IN_PROGRESS
    await prisma.booking.update({
      where: { id: testBookingId },
      data: { status: BookingStatus.IN_PROGRESS },
    });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${testBookingId}/complete`)
      .set('Cookie', renter1Cookies)
      .set('x-csrf-token', renter1Csrf)
      .expect(422);

    assert.equal(res.body.error?.code, 'CHECKLIST_INCOMPLETE');
  });

  it('5. PUT /api/v1/bookings/:id/inspections rejects CHECK_OUT draft with odometerKm < checkIn.odometerKm (BR-10)', async () => {
    const res = await request(app.getHttpServer())
      .put(`/api/v1/bookings/${testBookingId}/inspections`)
      .set('Cookie', renter1Cookies)
      .set('x-csrf-token', renter1Csrf)
      .send({
        type: InspectionType.CHECK_OUT,
        odometerKm: 11500, // < 12000 check-in
        fuelPercent: 80,
        damageNotes: 'Minor scratch',
        photos: [],
      })
      .expect(400);

    assert.ok(res.body.error?.message?.includes('không được nhỏ hơn số km lúc nhận xe'));
  });

  it('6. Creates valid CHECK_OUT inspection draft and finalizes with 4 angle photos', async () => {
    // Create draft with valid odo (12150 km)
    const draftRes = await request(app.getHttpServer())
      .put(`/api/v1/bookings/${testBookingId}/inspections`)
      .set('Cookie', renter1Cookies)
      .set('x-csrf-token', renter1Csrf)
      .send({
        type: InspectionType.CHECK_OUT,
        odometerKm: 12150,
        fuelPercent: 85,
        damageNotes: 'Xe sạch sẽ, đầy đủ phụ kiện',
        photos: [
          { angle: InspectionAngle.FRONT, mediaId: outFrontMediaId },
          { angle: InspectionAngle.REAR, mediaId: outRearMediaId },
          { angle: InspectionAngle.LEFT, mediaId: outLeftMediaId },
          { angle: InspectionAngle.RIGHT, mediaId: outRightMediaId },
        ],
      })
      .expect(200);

    assert.ok(draftRes.body.data.id);
    assert.equal(draftRes.body.data.type, InspectionType.CHECK_OUT);
    assert.equal(draftRes.body.data.odometerKm, 12150);

    // Finalize CHECK_OUT inspection
    const finalizeRes = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${testBookingId}/inspections/CHECK_OUT/finalize`)
      .set('Cookie', renter1Cookies)
      .set('x-csrf-token', renter1Csrf)
      .send({ acknowledged: true })
      .expect(200);

    assert.equal(finalizeRes.body.data.acknowledged, true);
    assert.ok(finalizeRes.body.data.finalizedAt);
  });

  it('7. POST /api/v1/bookings/:id/complete rejects 409 UNRESOLVED_OPERATION if a keyless operation is PENDING', async () => {
    // Insert a pending keyless operation
    const op = await prisma.keylessOperation.create({
      data: {
        id: randomUUID(),
        bookingId: testBookingId,
        actorId: renter1Id,
        action: KeylessAction.LOCK,
        status: KeylessOperationStatus.PENDING,
        idempotencyKey: 'idem-key-pending-op-test',
        requestHash: 'mockhash',
      },
    });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${testBookingId}/complete`)
      .set('Cookie', renter1Cookies)
      .set('x-csrf-token', renter1Csrf)
      .expect(409);

    assert.equal(res.body.error?.code, 'UNRESOLVED_OPERATION');

    // Clean up the pending operation
    await prisma.keylessOperation.delete({ where: { id: op.id } });
  });

  it('8. POST /api/v1/bookings/:id/complete successfully completes trip, releases calendar, and notifies parties', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${testBookingId}/complete`)
      .set('Cookie', renter1Cookies)
      .set('x-csrf-token', renter1Csrf)
      .expect(200);

    assert.equal(res.body.data.status, 'COMPLETED');

    // Check database state: vehicle calendar released
    const calendars = await prisma.vehicleCalendar.findMany({
      where: { bookingId: testBookingId },
    });
    assert.ok(calendars.length > 0);
    for (const cal of calendars) {
      assert.ok(cal.releasedAt !== null, 'Lịch xe phải được giải phóng (releasedAt != null)');
    }

    // Check database state: TRIP_COMPLETED event emitted
    const tripCompletedEvent = await prisma.bookingEvent.findFirst({
      where: {
        bookingId: testBookingId,
        eventType: 'TRIP_COMPLETED',
      },
    });
    assert.ok(tripCompletedEvent, 'Phải có sự kiện TRIP_COMPLETED');
    assert.equal(tripCompletedEvent?.fromStatus, 'IN_PROGRESS');
    assert.equal(tripCompletedEvent?.toStatus, 'COMPLETED');

    // Check database state: notifications created for both owner and renter
    const notifications = await prisma.notification.findMany({
      where: { bookingId: testBookingId, type: 'TRIP_COMPLETED' },
    });
    assert.equal(
      notifications.length,
      2,
      'Cả chủ xe và người thuê đều nhận thông báo hoàn tất chuyến',
    );
    const recipientIds = notifications.map((n) => n.userId);
    assert.ok(recipientIds.includes(owner1Id));
    assert.ok(recipientIds.includes(renter1Id));
  });

  it('9. POST /api/v1/bookings/:id/complete is idempotent on already COMPLETED booking', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${testBookingId}/complete`)
      .set('Cookie', renter1Cookies)
      .set('x-csrf-token', renter1Csrf)
      .expect(200);

    assert.equal(res.body.data.status, 'COMPLETED');
  });
});
