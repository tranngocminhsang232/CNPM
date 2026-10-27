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
import { BookingStatus, InspectionType, PaymentStatus, PaymentType } from '@prisma/client';

describe('Deposit Settlement API (e2e) - G5-02', () => {
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
  let vehicleId: string;

  let inInspectionId: string;
  let outInspectionId: string;

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

    // 4. Find vehicle
    const vehicle = await prisma.vehicle.findFirstOrThrow({
      where: { plateNormalized: '51K-10001' },
    });
    vehicleId = vehicle.id;

    // 5. Create test booking
    const now = new Date();
    const startAt = new Date(now.getTime() - 24 * 3600 * 1000);
    const endAt = new Date(now.getTime() - 2 * 3600 * 1000);

    testBookingId = randomUUID();
    await prisma.booking.create({
      data: {
        id: testBookingId,
        vehicleId,
        renterId: renter1Id,
        ownerId: owner1Id,
        startAt,
        endAt,
        status: BookingStatus.IN_PROGRESS,
        requestExpiresAt: new Date(startAt.getTime() - 3600 * 1000),
      },
    });

    // Create pricing snapshot with 10M deposit
    await prisma.pricingSnapshot.create({
      data: {
        bookingId: testBookingId,
        currency: 'VND',
        pricePerDayVnd: BigInt(1400000),
        rentalDays: 1,
        subtotalVnd: BigInt(1400000),
        serviceFeeVnd: BigInt(140000),
        depositVnd: BigInt(10000000),
        totalVnd: BigInt(11540000),
        pricingVersion: 'daily-v1',
      },
    });

    // 6. Create Check-In inspection (fuel: 95%) and Check-Out inspection (fuel: 80% -> 15% shortfall)
    inInspectionId = randomUUID();
    await prisma.inspection.create({
      data: {
        id: inInspectionId,
        bookingId: testBookingId,
        type: InspectionType.CHECK_IN,
        odometerKm: 20000,
        fuelPercent: 95,
        acknowledged: true,
        finalizedAt: new Date(startAt.getTime() + 10 * 60 * 1000),
        version: 1,
        performedBy: renter1Id,
      },
    });

    outInspectionId = randomUUID();
    await prisma.inspection.create({
      data: {
        id: outInspectionId,
        bookingId: testBookingId,
        type: InspectionType.CHECK_OUT,
        odometerKm: 20250,
        fuelPercent: 80,
        acknowledged: true,
        finalizedAt: new Date(endAt.getTime() + 10 * 60 * 1000),
        version: 1,
        performedBy: renter1Id,
      },
    });
  });

  after(async () => {
    // Cleanup
    await prisma.payment.deleteMany({ where: { bookingId: testBookingId } });
    await prisma.notification.deleteMany({ where: { bookingId: testBookingId } });
    await prisma.bookingEvent.deleteMany({ where: { bookingId: testBookingId } });
    await prisma.inspection.deleteMany({ where: { bookingId: testBookingId } });
    await prisma.pricingSnapshot.deleteMany({ where: { bookingId: testBookingId } });
    await prisma.booking.deleteMany({ where: { id: testBookingId } });
    await app.close();
  });

  it('1. POST /api/v1/bookings/:id/settle-deposit rejects unauthenticated (401)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/bookings/${testBookingId}/settle-deposit`)
      .send({})
      .expect(401);
  });

  it('2. POST /api/v1/bookings/:id/settle-deposit rejects stranger (403 FORBIDDEN)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${testBookingId}/settle-deposit`)
      .set('Cookie', renter2Cookies)
      .set('x-csrf-token', renter2Csrf)
      .send({})
      .expect(403);

    assert.equal(res.body.error?.code, 'FORBIDDEN');
  });

  it('3. POST /api/v1/bookings/:id/settle-deposit rejects renter attempting to settle (403 FORBIDDEN)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${testBookingId}/settle-deposit`)
      .set('Cookie', renter1Cookies)
      .set('x-csrf-token', renter1Csrf)
      .send({})
      .expect(403);

    assert.equal(res.body.error?.code, 'FORBIDDEN');
  });

  it('4. POST /api/v1/bookings/:id/settle-deposit rejects 409 INVALID_BOOKING_STATUS when booking is still IN_PROGRESS', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${testBookingId}/settle-deposit`)
      .set('Cookie', owner1Cookies)
      .set('x-csrf-token', owner1Csrf)
      .send({})
      .expect(409);

    assert.equal(res.body.error?.code, 'INVALID_BOOKING_STATUS');
  });

  it('5. GET /api/v1/bookings/:id/settlement allows renter to view calculation preview (status PENDING)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/bookings/${testBookingId}/settlement`)
      .set('Cookie', renter1Cookies)
      .expect(200);

    assert.equal(res.body.data.status, 'PENDING');
    assert.equal(res.body.data.depositVnd, 10000000);
    // 95% - 80% = 15% shortfall * 30k = 450,000 VND
    assert.equal(res.body.data.breakdown.fuelShortfallPercent, 15);
    assert.equal(res.body.data.breakdown.fuelSurchargeVnd, 450000);
    assert.equal(res.body.data.refundAmountVnd, 9550000);
  });

  it('6. Owner triggers POST /api/v1/bookings/:id/settle-deposit on COMPLETED booking', async () => {
    // Transition booking to COMPLETED
    await prisma.booking.update({
      where: { id: testBookingId },
      data: { status: BookingStatus.COMPLETED, completedAt: new Date() },
    });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${testBookingId}/settle-deposit`)
      .set('Cookie', owner1Cookies)
      .set('x-csrf-token', owner1Csrf)
      .send({
        cleaningFeeVnd: 100000,
        otherSurchargeVnd: 0,
        damageNotes: 'Khấu trừ 15% xăng hao hụt và phí rửa xe',
      })
      .expect(200);

    assert.equal(res.body.data.status, 'SETTLED');
    assert.equal(res.body.data.depositVnd, 10000000);
    assert.equal(res.body.data.breakdown.fuelShortfallPercent, 15);
    assert.equal(res.body.data.breakdown.fuelSurchargeVnd, 450000);
    assert.equal(res.body.data.breakdown.cleaningFeeVnd, 100000);
    assert.equal(res.body.data.breakdown.totalSurchargesVnd, 550000); // 450k + 100k
    assert.equal(res.body.data.refundAmountVnd, 9450000); // 10M - 550k
    assert.ok(res.body.data.refundTransactionRef?.startsWith('REFUND-'));

    // Check DB payment record
    const refundPayment = await prisma.payment.findFirst({
      where: {
        bookingId: testBookingId,
        paymentType: PaymentType.REFUND,
      },
    });
    assert.ok(refundPayment);
    assert.equal(Number(refundPayment.amountVnd), 9450000);
    assert.equal(refundPayment.status, PaymentStatus.SUCCESS);

    // Check DB event
    const settledEvent = await prisma.bookingEvent.findFirst({
      where: { bookingId: testBookingId, eventType: 'DEPOSIT_SETTLED' },
    });
    assert.ok(settledEvent);

    // Check DB notifications for both parties
    const notifications = await prisma.notification.findMany({
      where: { bookingId: testBookingId, type: 'DEPOSIT_SETTLED' },
    });
    assert.equal(notifications.length, 2);
    const recipientIds = notifications.map((n) => n.userId);
    assert.ok(recipientIds.includes(renter1Id));
    assert.ok(recipientIds.includes(owner1Id));
  });

  it('7. POST /api/v1/bookings/:id/settle-deposit is idempotent on already settled booking', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${testBookingId}/settle-deposit`)
      .set('Cookie', owner1Cookies)
      .set('x-csrf-token', owner1Csrf)
      .send({ cleaningFeeVnd: 0 })
      .expect(200);

    assert.equal(res.body.data.status, 'SETTLED');
    assert.equal(res.body.data.refundAmountVnd, 9450000);
  });

  it('8. GET /api/v1/bookings/:id/settlement returns SETTLED status and refund details', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/bookings/${testBookingId}/settlement`)
      .set('Cookie', renter1Cookies)
      .expect(200);

    assert.equal(res.body.data.status, 'SETTLED');
    assert.equal(res.body.data.depositVnd, 10000000);
    assert.equal(res.body.data.refundAmountVnd, 9450000);
    assert.ok(res.body.data.refundTransactionRef);
    assert.ok(res.body.data.settledAt);
  });
});
