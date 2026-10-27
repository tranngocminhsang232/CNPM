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
import { MediaPurpose, MediaState } from '@prisma/client';

describe('Security Audit & Access Control Matrix (e2e) - G5-05', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let renter1Cookies: string[];
  let renter1Csrf: string;
  let renter1Id: string;

  let owner1Cookies: string[];
  let owner1Csrf: string;
  let owner1Id: string;

  let strangerCookies: string[];
  let strangerCsrf: string;

  let testVehicleId: string;
  let testBookingId: string;
  let driverLicenseMediaId: string;

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

    // 1. Login renter1 (valid renter)
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

    // Ensure renter1 is KYC verified
    await prisma.user.update({
      where: { id: renter1Id },
      data: { kycStatus: 'VERIFIED' },
    });

    // 2. Login owner1 (valid vehicle owner)
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

    // 3. Login stranger (renter2, neither renter nor owner of test booking)
    const strangerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'renter2@carsharing.local',
        password: 'DemoPassword123!',
      })
      .expect(200);

    strangerCsrf = strangerLogin.body.data.csrfToken;
    strangerCookies = (strangerLogin.headers['set-cookie'] as unknown as string[]).map(
      (c) => (c.split(';')[0] as string) || c,
    );

    // Find test vehicle belonging to owner1
    const vehicle = await prisma.vehicle.findFirst({
      where: { ownerId: owner1Id, status: 'PUBLISHED' },
    });
    assert.ok(vehicle, 'Must have a published vehicle for owner1');
    testVehicleId = vehicle.id;

    // Create a confidential Driver License MediaObject for renter1
    const dlMedia = await prisma.mediaObject.create({
      data: {
        id: randomUUID(),
        uploaderId: renter1Id,
        purpose: MediaPurpose.IDENTITY_DOCUMENT,
        mimeType: 'image/jpeg',
        sizeBytes: 102400,
        stagingKey: `staging/dl-${randomUUID()}.jpg`,
        finalKey: `finalized/identity_document/dl-${randomUUID()}.jpg`,
        checksum: 'sha256-dummy-dl-checksum',
        state: MediaState.VERIFIED,
      },
    });
    driverLicenseMediaId = dlMedia.id;
  });

  after(async () => {
    if (driverLicenseMediaId) {
      await prisma.mediaObject.deleteMany({ where: { id: driverLicenseMediaId } }).catch(() => {});
    }
    if (testBookingId) {
      await prisma.bookingEvent.deleteMany({ where: { bookingId: testBookingId } }).catch(() => {});
      await prisma.notification.deleteMany({ where: { bookingId: testBookingId } }).catch(() => {});
      await prisma.pricingSnapshot
        .deleteMany({ where: { bookingId: testBookingId } })
        .catch(() => {});
      await prisma.vehicleCalendar
        .deleteMany({ where: { bookingId: testBookingId } })
        .catch(() => {});
      await prisma.booking.deleteMany({ where: { id: testBookingId } }).catch(() => {});
    }
    await app.close();
  });

  // =========================================================================
  // 1. PII & SENSITIVE DATA MASKING ON PUBLIC ENDPOINTS (NFR-02, BR-02)
  // =========================================================================
  describe('1. Sensitive Vehicle Data Masking (Public Endpoints)', () => {
    it('GET /api/v1/vehicles must NEVER leak plateNormalized or pickupAddress', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/vehicles').expect(200);

      const items = res.body.data;
      assert.ok(Array.isArray(items), 'Items must be an array');
      assert.ok(items.length > 0, 'Items should not be empty');

      for (const item of items) {
        assert.strictEqual(
          item.plateNormalized,
          undefined,
          'plateNormalized must be stripped from public vehicle list',
        );
        assert.strictEqual(
          item.pickupAddress,
          undefined,
          'pickupAddress must be stripped from public vehicle list',
        );
        assert.strictEqual(item.vin, undefined, 'vin must never be exposed');
      }
    });

    it('GET /api/v1/vehicles/:id must NEVER leak plateNormalized or pickupAddress to public visitors', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/vehicles/${testVehicleId}`)
        .expect(200);

      const vehicle = res.body.data;
      assert.strictEqual(
        vehicle.plateNormalized,
        undefined,
        'plateNormalized must be stripped from public vehicle detail',
      );
      assert.strictEqual(
        vehicle.pickupAddress,
        undefined,
        'pickupAddress must be stripped from public vehicle detail',
      );
      assert.strictEqual(vehicle.vin, undefined, 'vin must never be exposed');
    });
  });

  // =========================================================================
  // 2. CSRF PROTECTION ENFORCEMENT ON ALL STATE-CHANGING ENDPOINTS (NFR-02)
  // =========================================================================
  describe('2. CSRF Double-Submit Protection', () => {
    it('POST /api/v1/bookings without x-csrf-token header must be rejected with 403', async () => {
      const startAt = new Date(Date.now() + 86400000 * 40).toISOString();
      const endAt = new Date(Date.now() + 86400000 * 42).toISOString();

      const res = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Cookie', renter1Cookies)
        .set('Idempotency-Key', randomUUID())
        .send({
          vehicleId: testVehicleId,
          startAt,
          endAt,
          expectedTotalVnd: 2000000,
        })
        .expect(403);

      assert.strictEqual(res.body.error.code, 'CSRF_INVALID');
    });

    it('POST /api/v1/bookings with mismatched x-csrf-token header must be rejected with 403', async () => {
      const startAt = new Date(Date.now() + 86400000 * 40).toISOString();
      const endAt = new Date(Date.now() + 86400000 * 42).toISOString();

      const res = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Cookie', renter1Cookies)
        .set('x-csrf-token', 'invalid-attacker-csrf-token')
        .set('Idempotency-Key', randomUUID())
        .send({
          vehicleId: testVehicleId,
          startAt,
          endAt,
          expectedTotalVnd: 2000000,
        })
        .expect(403);

      assert.strictEqual(res.body.error.code, 'CSRF_INVALID');
    });
  });

  // =========================================================================
  // 3. BOOKING PRIVACY & CONDITIONAL MASKING (BR-02)
  // =========================================================================
  describe('3. Booking Plate & Address Concealment (Until Approved)', () => {
    it('Creates booking in REQUESTED status: plate & address must be masked for renter', async () => {
      const startAt = new Date(Date.now() + 86400000 * 50);
      const endAt = new Date(Date.now() + 86400000 * 52);

      // Quote first to get exact expectedTotalVnd
      const quoteRes = await request(app.getHttpServer())
        .post('/api/v1/pricing/quote')
        .send({
          vehicleId: testVehicleId,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
        })
        .expect(200);

      const expectedTotalVnd = quoteRes.body.data.totalVnd;

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Cookie', renter1Cookies)
        .set('x-csrf-token', renter1Csrf)
        .set('Idempotency-Key', randomUUID())
        .send({
          vehicleId: testVehicleId,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          expectedTotalVnd,
        })
        .expect(201);

      testBookingId = createRes.body.data.id;
      assert.strictEqual(createRes.body.data.status, 'REQUESTED');

      // Fetch booking details as renter while REQUESTED
      const getRes = await request(app.getHttpServer())
        .get(`/api/v1/bookings/${testBookingId}`)
        .set('Cookie', renter1Cookies)
        .expect(200);

      const booking = getRes.body.data;
      assert.strictEqual(
        booking.vehicle.plateNormalized,
        null,
        'plateNormalized must be null while booking is REQUESTED',
      );
      assert.strictEqual(
        booking.vehicle.pickupAddress,
        null,
        'pickupAddress must be null while booking is REQUESTED',
      );
    });

    it('Once APPROVED by owner, renter can securely view plate and pickupAddress', async () => {
      // Owner approves booking
      await request(app.getHttpServer())
        .post(`/api/v1/bookings/${testBookingId}/approve`)
        .set('Cookie', owner1Cookies)
        .set('x-csrf-token', owner1Csrf)
        .expect(200);

      // Fetch booking details as renter while APPROVED
      const getRes = await request(app.getHttpServer())
        .get(`/api/v1/bookings/${testBookingId}`)
        .set('Cookie', renter1Cookies)
        .expect(200);

      const booking = getRes.body.data;
      assert.strictEqual(booking.status, 'APPROVED');
      assert.ok(
        booking.vehicle.plateNormalized !== null && booking.vehicle.plateNormalized !== undefined,
        'plateNormalized must be revealed once APPROVED',
      );
      assert.ok(
        booking.vehicle.pickupAddress !== null && booking.vehicle.pickupAddress !== undefined,
        'pickupAddress must be revealed once APPROVED',
      );
    });
  });

  // =========================================================================
  // 4. CROSS-TENANT ISOLATION & STRANGER ACCESS DENIAL (NFR-02)
  // =========================================================================
  describe('4. Cross-Tenant Authorization & Boundary Isolation', () => {
    it('Stranger cannot view booking details (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/bookings/${testBookingId}`)
        .set('Cookie', strangerCookies)
        .expect(403);
    });

    it('Stranger cannot approve booking (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/bookings/${testBookingId}/approve`)
        .set('Cookie', strangerCookies)
        .set('x-csrf-token', strangerCsrf)
        .expect(403);
    });

    it('Stranger cannot trigger Keyless operations (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/bookings/${testBookingId}/keyless-operations`)
        .set('Cookie', strangerCookies)
        .set('x-csrf-token', strangerCsrf)
        .set('Idempotency-Key', randomUUID())
        .send({ action: 'UNLOCK' })
        .expect(403);
    });

    it('Stranger cannot complete booking (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/bookings/${testBookingId}/complete`)
        .set('Cookie', strangerCookies)
        .set('x-csrf-token', strangerCsrf)
        .expect(403);
    });

    it('Stranger cannot settle deposit (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/bookings/${testBookingId}/settle-deposit`)
        .set('Cookie', strangerCookies)
        .set('x-csrf-token', strangerCsrf)
        .send({ cleaningFeeVnd: 0, otherSurchargeVnd: 0 })
        .expect(403);
    });

    it('Stranger cannot review booking (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/bookings/${testBookingId}/reviews`)
        .set('Cookie', strangerCookies)
        .set('x-csrf-token', strangerCsrf)
        .send({ score: 5, comment: 'Illegal review' })
        .expect(403);
    });
  });

  // =========================================================================
  // 5. KYC & DRIVER LICENSE DOCUMENT PRIVACY (NFR-02, BR-01)
  // =========================================================================
  describe('5. Driver License & KYC Document Privacy', () => {
    it('Unauthenticated user cannot access /api/v1/users/me/driver-license (401 Unauthorized)', async () => {
      await request(app.getHttpServer()).get('/api/v1/users/me/driver-license').expect(401);
    });

    it('User can only view their own driver license information', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users/me/driver-license')
        .set('Cookie', renter1Cookies)
        .expect(200);

      assert.strictEqual(res.body.data.userId, renter1Id);
    });

    it('Stranger cannot get presigned read URL for private driver license photo (403 Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/media/${driverLicenseMediaId}/read-url`)
        .set('Cookie', strangerCookies)
        .expect(403);

      assert.strictEqual(res.body.error.code, 'FORBIDDEN');
    });

    it('Owner of driver license photo CAN get presigned read URL (200 OK)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/media/${driverLicenseMediaId}/read-url`)
        .set('Cookie', renter1Cookies)
        .expect(200);

      assert.ok(res.body.data.url, 'Should return valid presigned URL');
    });
  });
});
