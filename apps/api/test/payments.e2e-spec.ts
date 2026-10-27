import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter, TransformInterceptor } from '../src/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { computePaymentSignature } from '../src/payments/payments.service';

describe('Payments API (e2e) - G3-02 Payment Gateway Sandbox & Escrow', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let renter1Cookies: string[];
  let renter1Csrf: string;
  let renter1Id: string;

  let owner1Cookies: string[];

  let renter2Cookies: string[];
  let renter2Csrf: string;

  const testVehicleId = '10000000-0000-0000-0000-000000000001';
  const startAt = '2026-11-28T08:00:00.000Z';
  const endAt = '2026-11-30T18:00:00.000Z';
  let createdBookingId: string;
  let expectedTotalVnd: number;
  let expectedDepositVnd: number;

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

    await prisma.user.update({
      where: { id: renter1Id },
      data: { kycStatus: 'VERIFIED' },
    });

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

    // 3. Login renter2
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

    // 4. Quote to get expected amounts
    const quoteRes = await request(app.getHttpServer())
      .post('/api/v1/pricing/quote')
      .send({
        vehicleId: testVehicleId,
        startAt,
        endAt,
      })
      .expect(200);

    expectedTotalVnd = quoteRes.body.data.totalVnd;
    expectedDepositVnd = quoteRes.body.data.depositVnd;

    // 5. Cleanup test data for this window
    const oldBookings = await prisma.booking.findMany({
      where: {
        vehicleId: testVehicleId,
        startAt: new Date(startAt),
      },
      select: { id: true },
    });
    const oldIds = oldBookings.map((b) => b.id);
    if (oldIds.length > 0) {
      await prisma.notification.deleteMany({ where: { bookingId: { in: oldIds } } });
      await prisma.payment.deleteMany({ where: { bookingId: { in: oldIds } } });
      await prisma.bookingEvent.deleteMany({ where: { bookingId: { in: oldIds } } });
      await prisma.idempotencyRecord.deleteMany({ where: { bookingId: { in: oldIds } } });
      await prisma.vehicleCalendar.deleteMany({ where: { bookingId: { in: oldIds } } });
      await prisma.pricingSnapshot.deleteMany({ where: { bookingId: { in: oldIds } } });
      await prisma.booking.deleteMany({ where: { id: { in: oldIds } } });
    }
    await prisma.vehicleCalendar.deleteMany({
      where: { vehicleId: testVehicleId, startAt: new Date(startAt) },
    });

    // 6. Create booking for renter1
    const createBookingRes = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Cookie', renter1Cookies)
      .set('x-csrf-token', renter1Csrf)
      .set('Idempotency-Key', 'test-payments-booking-001')
      .send({
        vehicleId: testVehicleId,
        startAt,
        endAt,
        insurancePackage: 'BASIC',
        expectedTotalVnd,
      })
      .expect(201);

    createdBookingId = createBookingRes.body.data.id;
    assert.ok(createdBookingId);
  });

  after(async () => {
    if (createdBookingId) {
      await prisma.notification.deleteMany({ where: { bookingId: createdBookingId } });
      await prisma.payment.deleteMany({ where: { bookingId: createdBookingId } });
      await prisma.bookingEvent.deleteMany({ where: { bookingId: createdBookingId } });
      await prisma.idempotencyRecord.deleteMany({ where: { bookingId: createdBookingId } });
      await prisma.vehicleCalendar.deleteMany({ where: { bookingId: createdBookingId } });
      await prisma.pricingSnapshot.deleteMany({ where: { bookingId: createdBookingId } });
      await prisma.booking.deleteMany({ where: { id: createdBookingId } });
    }
    await app.close();
  });

  let depositTransactionRef: string;
  let fullPaymentTransactionRef: string;

  it('1. POST /api/v1/payments/create-intent rejects unauthenticated (401)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/payments/create-intent')
      .send({
        bookingId: createdBookingId,
        paymentType: 'DEPOSIT',
      })
      .expect(401);

    assert.equal(res.body.error.code, 'UNAUTHORIZED');
  });

  it('2. POST /api/v1/payments/create-intent rejects unauthorized renter (403)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/payments/create-intent')
      .set('Cookie', renter2Cookies)
      .set('x-csrf-token', renter2Csrf)
      .send({
        bookingId: createdBookingId,
        paymentType: 'DEPOSIT',
      })
      .expect(403);

    assert.equal(res.body.error.code, 'FORBIDDEN');
  });

  it('3. POST /api/v1/payments/create-intent rejects non-existent booking (404)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/payments/create-intent')
      .set('Cookie', renter1Cookies)
      .set('x-csrf-token', renter1Csrf)
      .send({
        bookingId: '99999999-9999-9999-9999-999999999999',
        paymentType: 'DEPOSIT',
      })
      .expect(404);

    assert.equal(res.body.error.code, 'NOT_FOUND');
  });

  it('4. POST /api/v1/payments/create-intent creates DEPOSIT intent with correct amount', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/payments/create-intent')
      .set('Cookie', renter1Cookies)
      .set('x-csrf-token', renter1Csrf)
      .send({
        bookingId: createdBookingId,
        paymentType: 'DEPOSIT',
      })
      .expect(201);

    assert.equal(res.body.data.bookingId, createdBookingId);
    assert.equal(res.body.data.paymentType, 'DEPOSIT');
    assert.equal(res.body.data.amountVnd, expectedDepositVnd);
    assert.equal(res.body.data.status, 'PENDING');
    assert.ok(res.body.data.transactionRef.startsWith('TX-'));

    depositTransactionRef = res.body.data.transactionRef;

    assert.ok(res.body.data.paymentUrl.includes('/checkout/payment-gateway?ref=TX-'));
  });

  it('5. POST /api/v1/payments/create-intent creates FULL_PAYMENT intent with total amount', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/payments/create-intent')
      .set('Cookie', renter1Cookies)
      .set('x-csrf-token', renter1Csrf)
      .send({
        bookingId: createdBookingId,
        paymentType: 'FULL_PAYMENT',
      })
      .expect(201);

    assert.equal(res.body.data.bookingId, createdBookingId);
    assert.equal(res.body.data.paymentType, 'FULL_PAYMENT');
    assert.equal(res.body.data.amountVnd, expectedTotalVnd);
    assert.equal(res.body.data.status, 'PENDING');

    fullPaymentTransactionRef = res.body.data.transactionRef;
  });

  it('6. GET /api/v1/payments/:ref rejects unauthenticated (401)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/payments/${depositTransactionRef}`)
      .expect(401);

    assert.equal(res.body.error.code, 'UNAUTHORIZED');
  });

  it('7. GET /api/v1/payments/:ref rejects unrelated user (403)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/payments/${depositTransactionRef}`)
      .set('Cookie', renter2Cookies)
      .expect(403);

    assert.equal(res.body.error.code, 'FORBIDDEN');
  });

  it('8. GET /api/v1/payments/:ref allows renter to view details (200)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/payments/${depositTransactionRef}`)
      .set('Cookie', renter1Cookies)
      .expect(200);

    assert.equal(res.body.data.transactionRef, depositTransactionRef);
    assert.equal(res.body.data.amountVnd, expectedDepositVnd);
    assert.equal(res.body.data.status, 'PENDING');
  });

  it('9. GET /api/v1/payments/:ref allows host/owner to view details (200)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/payments/${depositTransactionRef}`)
      .set('Cookie', owner1Cookies)
      .expect(200);

    assert.equal(res.body.data.transactionRef, depositTransactionRef);
    assert.equal(res.body.data.amountVnd, expectedDepositVnd);
  });

  it('10. POST /api/v1/payments/webhook rejects forged HMAC signature (403)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/payments/webhook')
      .send({
        transactionRef: depositTransactionRef,
        amountVnd: expectedDepositVnd,
        status: 'SUCCESS',
        signature:
          'invalid_forged_signature_00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
        gatewayTxnId: 'GW-FAKE-001',
      })
      .expect(403);

    assert.equal(res.body.error.code, 'INVALID_SIGNATURE');
  });

  it('11. POST /api/v1/payments/webhook rejects non-existent transactionRef (404)', async () => {
    const signature = computePaymentSignature('TX-NONEXISTENT-999', expectedDepositVnd, 'SUCCESS');

    const res = await request(app.getHttpServer())
      .post('/api/v1/payments/webhook')
      .send({
        transactionRef: 'TX-NONEXISTENT-999',
        amountVnd: expectedDepositVnd,
        status: 'SUCCESS',
        signature,
        gatewayTxnId: 'GW-FAKE-002',
      })
      .expect(404);

    assert.equal(res.body.error.code, 'NOT_FOUND');
  });

  it('12. POST /api/v1/payments/webhook processes SUCCESS and emits PAYMENT_RECEIVED event', async () => {
    const signature = computePaymentSignature(depositTransactionRef, expectedDepositVnd, 'SUCCESS');

    const res = await request(app.getHttpServer())
      .post('/api/v1/payments/webhook')
      .send({
        transactionRef: depositTransactionRef,
        amountVnd: expectedDepositVnd,
        status: 'SUCCESS',
        signature,
        gatewayTxnId: 'VNPay-SANDBOX-78901',
      })
      .expect(200);

    assert.equal(res.body.data.status, 'SUCCESS');
    assert.ok(res.body.data.paidAt);

    // Verify DB update
    const payment = await prisma.payment.findUnique({
      where: { transactionRef: depositTransactionRef },
    });
    assert.equal(payment?.status, 'SUCCESS');
    assert.equal(payment?.gatewayTxnId, 'VNPay-SANDBOX-78901');
    assert.ok(payment?.paidAt);

    // Verify BookingEvent was created
    const event = await prisma.bookingEvent.findFirst({
      where: {
        bookingId: createdBookingId,
        eventType: 'PAYMENT_RECEIVED',
      },
    });
    assert.ok(event);

    // Verify Notification was created
    const notification = await prisma.notification.findFirst({
      where: {
        bookingId: createdBookingId,
        type: 'PAYMENT_RECEIVED',
      },
    });
    assert.ok(notification);
  });

  it('13. POST /api/v1/payments/webhook is idempotent on replay (200)', async () => {
    const signature = computePaymentSignature(depositTransactionRef, expectedDepositVnd, 'SUCCESS');

    const res = await request(app.getHttpServer())
      .post('/api/v1/payments/webhook')
      .send({
        transactionRef: depositTransactionRef,
        amountVnd: expectedDepositVnd,
        status: 'SUCCESS',
        signature,
        gatewayTxnId: 'VNPay-SANDBOX-78901-DUPLICATE',
      })
      .expect(200);

    assert.equal(res.body.data.status, 'SUCCESS');
    // Original gatewayTxnId preserved
    assert.equal(res.body.data.gatewayTxnId, 'VNPay-SANDBOX-78901');
  });

  it('14. POST /api/v1/payments/simulate simulates payment with SUCCESS (200)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/payments/simulate')
      .send({
        transactionRef: fullPaymentTransactionRef,
        status: 'SUCCESS',
      })
      .expect(200);

    assert.equal(res.body.data.status, 'SUCCESS');
    assert.ok(res.body.data.paidAt);

    const check = await prisma.payment.findUnique({
      where: { transactionRef: fullPaymentTransactionRef },
    });
    assert.equal(check?.status, 'SUCCESS');
  });
});
