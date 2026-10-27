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
import { InspectionAngle, MediaPurpose, MediaState } from '@prisma/client';

describe('Inspections API (e2e) - G4-01 Handover & Inspection Checklist', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let renter1Cookies: string[];
  let renter1Csrf: string;
  let renter1Id: string;

  let owner1Cookies: string[];

  let renter2Cookies: string[];
  let renter2Csrf: string;

  const testBookingId = '20000000-0000-0000-0000-000000000003'; // APPROVED seed booking
  let frontMediaId: string;
  let rearMediaId: string;
  let leftMediaId: string;
  let rightMediaId: string;

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

    owner1Cookies = (owner1Login.headers['set-cookie'] as unknown as string[]).map(
      (c) => (c.split(';')[0] as string) || c,
    );

    // 3. Login renter2 (third party)
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

    // 4. Create 4 verified media objects for testing inspection photos
    frontMediaId = randomUUID();
    rearMediaId = randomUUID();
    leftMediaId = randomUUID();
    rightMediaId = randomUUID();

    const mediaList = [
      { id: frontMediaId, angle: 'front' },
      { id: rearMediaId, angle: 'rear' },
      { id: leftMediaId, angle: 'left' },
      { id: rightMediaId, angle: 'right' },
    ];

    for (const m of mediaList) {
      await prisma.mediaObject.create({
        data: {
          id: m.id,
          uploaderId: renter1Id,
          purpose: MediaPurpose.INSPECTION_PHOTO,
          stagingKey: `staging/inspections/${m.id}.jpg`,
          finalKey: `finalized/inspection_photo/${m.id}.jpg`,
          mimeType: 'image/jpeg',
          sizeBytes: 102400,
          checksum: 'test-checksum',
          state: MediaState.VERIFIED,
          verifiedAt: new Date(),
        },
      });
    }

    // Clean up any existing inspection on test booking
    await prisma.inspectionPhoto.deleteMany({
      where: { inspection: { bookingId: testBookingId } },
    });
    await prisma.inspection.deleteMany({
      where: { bookingId: testBookingId },
    });
  });

  after(async () => {
    // Cleanup created inspection and media
    await prisma.inspectionPhoto.deleteMany({
      where: { inspection: { bookingId: testBookingId } },
    });
    await prisma.inspection.deleteMany({
      where: { bookingId: testBookingId },
    });
    await prisma.mediaObject.deleteMany({
      where: { id: { in: [frontMediaId, rearMediaId, leftMediaId, rightMediaId] } },
    });
    await app.close();
  });

  it('1. PUT /api/v1/bookings/:id/inspections rejects unauthenticated (401)', async () => {
    await request(app.getHttpServer())
      .put(`/api/v1/bookings/${testBookingId}/inspections`)
      .send({
        type: 'CHECK_IN',
        odometerKm: 15000,
        fuelPercent: 100,
        photos: [],
      })
      .expect(401);
  });

  it('2. PUT /api/v1/bookings/:id/inspections rejects missing CSRF token (403)', async () => {
    await request(app.getHttpServer())
      .put(`/api/v1/bookings/${testBookingId}/inspections`)
      .set('Cookie', renter1Cookies)
      .send({
        type: 'CHECK_IN',
        odometerKm: 15000,
        fuelPercent: 100,
        photos: [],
      })
      .expect(403);
  });

  it('3. PUT /api/v1/bookings/:id/inspections rejects unrelated user (403 FORBIDDEN)', async () => {
    const res = await request(app.getHttpServer())
      .put(`/api/v1/bookings/${testBookingId}/inspections`)
      .set('Cookie', renter2Cookies)
      .set('X-CSRF-Token', renter2Csrf)
      .send({
        type: 'CHECK_IN',
        odometerKm: 15000,
        fuelPercent: 100,
        photos: [],
      })
      .expect(403);

    assert.ok(res.body.error?.message?.includes('không có quyền'));
  });

  it('4. PUT /api/v1/bookings/:id/inspections rejects negative odometer or fuel > 100 (400)', async () => {
    await request(app.getHttpServer())
      .put(`/api/v1/bookings/${testBookingId}/inspections`)
      .set('Cookie', renter1Cookies)
      .set('X-CSRF-Token', renter1Csrf)
      .send({
        type: 'CHECK_IN',
        odometerKm: -50,
        fuelPercent: 120,
        photos: [],
      })
      .expect(400);
  });

  it('5. PUT /api/v1/bookings/:id/inspections creates valid CHECK_IN draft', async () => {
    const res = await request(app.getHttpServer())
      .put(`/api/v1/bookings/${testBookingId}/inspections`)
      .set('Cookie', renter1Cookies)
      .set('X-CSRF-Token', renter1Csrf)
      .send({
        type: 'CHECK_IN',
        odometerKm: 15420,
        fuelPercent: 95,
        damageNotes: 'Trầy xước nhỏ ở tai gương phụ',
        photos: [
          { angle: InspectionAngle.FRONT, mediaId: frontMediaId },
          { angle: InspectionAngle.REAR, mediaId: rearMediaId },
        ],
      })
      .expect(200);

    assert.strictEqual(res.body.data.bookingId, testBookingId);
    assert.strictEqual(res.body.data.type, 'CHECK_IN');
    assert.strictEqual(res.body.data.odometerKm, 15420);
    assert.strictEqual(res.body.data.fuelPercent, 95);
    assert.strictEqual(res.body.data.damageNotes, 'Trầy xước nhỏ ở tai gương phụ');
    assert.strictEqual(res.body.data.acknowledged, false);
    assert.strictEqual(res.body.data.finalizedAt, null);
    assert.strictEqual(res.body.data.photos.length, 2);
  });

  it('6. GET /api/v1/bookings/:id/inspections returns list for booking participants', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/bookings/${testBookingId}/inspections`)
      .set('Cookie', renter1Cookies)
      .expect(200);

    assert.ok(Array.isArray(res.body.data));
    assert.strictEqual(res.body.data.length, 1);
    assert.strictEqual(res.body.data[0].type, 'CHECK_IN');
  });

  it('7. GET /api/v1/bookings/:id/inspections/CHECK_IN returns inspection detail', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/bookings/${testBookingId}/inspections/CHECK_IN`)
      .set('Cookie', owner1Cookies) // Host can also view!
      .expect(200);

    assert.strictEqual(res.body.data.type, 'CHECK_IN');
    assert.strictEqual(res.body.data.odometerKm, 15420);
    assert.strictEqual(res.body.data.photos.length, 2);
  });

  it('8. POST /api/v1/bookings/:id/inspections/CHECK_IN/finalize rejects when missing angles (422)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${testBookingId}/inspections/CHECK_IN/finalize`)
      .set('Cookie', renter1Cookies)
      .set('X-CSRF-Token', renter1Csrf)
      .expect(422);

    assert.ok(res.body.error?.message?.includes('LEFT'));
    assert.ok(res.body.error?.message?.includes('RIGHT'));
  });

  it('9. PUT /api/v1/bookings/:id/inspections updates inspection with all 4 mandatory angles', async () => {
    const res = await request(app.getHttpServer())
      .put(`/api/v1/bookings/${testBookingId}/inspections`)
      .set('Cookie', renter1Cookies)
      .set('X-CSRF-Token', renter1Csrf)
      .send({
        type: 'CHECK_IN',
        odometerKm: 15420,
        fuelPercent: 95,
        damageNotes: 'Trầy xước nhỏ ở tai gương phụ',
        photos: [
          { angle: InspectionAngle.FRONT, mediaId: frontMediaId },
          { angle: InspectionAngle.REAR, mediaId: rearMediaId },
          { angle: InspectionAngle.LEFT, mediaId: leftMediaId },
          { angle: InspectionAngle.RIGHT, mediaId: rightMediaId },
        ],
      })
      .expect(200);

    assert.strictEqual(res.body.data.photos.length, 4);
  });

  it('10. POST /api/v1/bookings/:id/inspections/CHECK_IN/finalize succeeds and seals inspection (200)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${testBookingId}/inspections/CHECK_IN/finalize`)
      .set('Cookie', renter1Cookies)
      .set('X-CSRF-Token', renter1Csrf)
      .expect(200);

    assert.strictEqual(res.body.data.acknowledged, true);
    assert.ok(res.body.data.finalizedAt);

    // Verify booking event was recorded
    const event = await prisma.bookingEvent.findFirst({
      where: {
        bookingId: testBookingId,
        eventType: 'INSPECTION_CHECK_IN_FINALIZED',
      },
    });
    assert.ok(event);
  });

  it('11. PUT /api/v1/bookings/:id/inspections rejects editing finalized inspection (409)', async () => {
    const res = await request(app.getHttpServer())
      .put(`/api/v1/bookings/${testBookingId}/inspections`)
      .set('Cookie', renter1Cookies)
      .set('X-CSRF-Token', renter1Csrf)
      .send({
        type: 'CHECK_IN',
        odometerKm: 16000,
        fuelPercent: 100,
        photos: [],
      })
      .expect(409);

    assert.ok(res.body.error?.message?.includes('đã được chốt'));
  });

  it('12. POST /api/v1/bookings/:id/inspections/CHECK_IN/finalize replay is idempotent (200)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${testBookingId}/inspections/CHECK_IN/finalize`)
      .set('Cookie', renter1Cookies)
      .set('X-CSRF-Token', renter1Csrf)
      .expect(200);

    assert.strictEqual(res.body.data.acknowledged, true);
    assert.ok(res.body.data.finalizedAt);
  });
});
