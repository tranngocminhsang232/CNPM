import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter, TransformInterceptor } from '../src/common';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Bookings API (e2e) - G3-01 Booking Lifecycle & State Machine', () => {
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
  let renter2Id: string;

  const testVehicleId = '10000000-0000-0000-0000-000000000001'; // Owned by owner1
  let createdBookingId: string;

  // Rental window: 2026-11-20T08:00:00.000Z to 2026-11-22T18:00:00.000Z (3 days)
  const startAt = '2026-11-20T08:00:00.000Z';
  const endAt = '2026-11-22T18:00:00.000Z';
  let expectedTotalVnd: number;

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
    const r1Cookies = renter1Login.headers['set-cookie'] as unknown as string[];
    renter1Cookies = r1Cookies.map((c) => (c.split(';')[0] as string) || c);

    // Ensure renter1 has KYC VERIFIED
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

    owner1Id = owner1Login.body.data.user.id;
    owner1Csrf = owner1Login.body.data.csrfToken;
    const o1Cookies = owner1Login.headers['set-cookie'] as unknown as string[];
    owner1Cookies = o1Cookies.map((c) => (c.split(';')[0] as string) || c);

    // 3. Login renter2
    const renter2Login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'renter2@carsharing.local',
        password: 'DemoPassword123!',
      })
      .expect(200);

    renter2Id = renter2Login.body.data.user.id;
    renter2Csrf = renter2Login.body.data.csrfToken;
    const r2Cookies = renter2Login.headers['set-cookie'] as unknown as string[];
    renter2Cookies = r2Cookies.map((c) => (c.split(';')[0] as string) || c);

    await prisma.user.update({
      where: { id: renter2Id },
      data: { kycStatus: 'VERIFIED' },
    });

    // 4. Calculate accurate quote to get expectedTotalVnd
    const quoteRes = await request(app.getHttpServer())
      .post('/api/v1/pricing/quote')
      .send({
        vehicleId: testVehicleId,
        startAt,
        endAt,
      })
      .expect(200);

    expectedTotalVnd = quoteRes.body.data.totalVnd;
    assert.ok(expectedTotalVnd > 0);

    // 5. Clean up any previous test bookings for this vehicle window
    const oldBookings = await prisma.booking.findMany({
      where: {
        vehicleId: testVehicleId,
        startAt: { in: [new Date(startAt), new Date('2026-11-25T08:00:00.000Z')] },
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
      await prisma.promotionUsage.deleteMany({ where: { bookingId: { in: oldIds } } });
      await prisma.booking.deleteMany({ where: { id: { in: oldIds } } });
    }
    await prisma.idempotencyRecord.deleteMany({
      where: { key: { startsWith: 'test-key-' } },
    });
    await prisma.vehicleCalendar.deleteMany({
      where: {
        vehicleId: testVehicleId,
        startAt: { in: [new Date(startAt), new Date('2026-11-25T08:00:00.000Z')] },
      },
    });
  });

  after(async () => {
    await app.close();
  });

  it('1. POST /api/v1/bookings rejects unauthenticated requests (401)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Idempotency-Key', 'test-key-unauthenticated-001')
      .send({
        vehicleId: testVehicleId,
        startAt,
        endAt,
        expectedTotalVnd,
      })
      .expect(401);

    assert.equal(res.body.error.code, 'UNAUTHORIZED');
  });

  it('2. POST /api/v1/bookings rejects user with KYC NONE (403 KYC_REQUIRED)', async () => {
    // Temporarily demote renter2 KYC
    await prisma.user.update({
      where: { id: renter2Id },
      data: { kycStatus: 'NONE' },
    });

    const res = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Cookie', renter2Cookies)
      .set('x-csrf-token', renter2Csrf)
      .set('Idempotency-Key', 'test-key-kyc-none-00000001')
      .send({
        vehicleId: testVehicleId,
        startAt,
        endAt,
        expectedTotalVnd,
      })
      .expect(403);

    assert.equal(res.body.error.code, 'KYC_REQUIRED');

    // Restore renter2 KYC
    await prisma.user.update({
      where: { id: renter2Id },
      data: { kycStatus: 'VERIFIED' },
    });
  });

  it('3. POST /api/v1/bookings rejects request missing Idempotency-Key (400 VALIDATION_ERROR)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Cookie', renter1Cookies)
      .set('x-csrf-token', renter1Csrf)
      .send({
        vehicleId: testVehicleId,
        startAt,
        endAt,
        expectedTotalVnd,
      })
      .expect(400);

    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  it('4. POST /api/v1/bookings rejects owner attempting to rent own car (403 SELF_BOOKING_FORBIDDEN)', async () => {
    // Ensure owner1 has KYC verified
    await prisma.user.update({
      where: { id: owner1Id },
      data: { kycStatus: 'VERIFIED' },
    });

    const res = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Cookie', owner1Cookies)
      .set('x-csrf-token', owner1Csrf)
      .set('Idempotency-Key', 'test-key-self-booking-0001')
      .send({
        vehicleId: testVehicleId,
        startAt,
        endAt,
        expectedTotalVnd,
      })
      .expect(403);

    assert.equal(res.body.error.code, 'SELF_BOOKING_FORBIDDEN');
  });

  it('5. POST /api/v1/bookings rejects mismatched expectedTotalVnd (409 PRICE_CHANGED)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Cookie', renter1Cookies)
      .set('x-csrf-token', renter1Csrf)
      .set('Idempotency-Key', 'test-key-price-changed-0001')
      .send({
        vehicleId: testVehicleId,
        startAt,
        endAt,
        expectedTotalVnd: expectedTotalVnd + 100000, // Outdated price
      })
      .expect(409);

    assert.equal(res.body.error.code, 'PRICE_CHANGED');
    assert.ok(res.body.error.details?.quote);
  });

  it('6. POST /api/v1/bookings creates booking in REQUESTED state (201 Created)', async () => {
    const idempotencyKey = 'test-key-successful-booking-001';

    const res = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Cookie', renter1Cookies)
      .set('x-csrf-token', renter1Csrf)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        vehicleId: testVehicleId,
        startAt,
        endAt,
        expectedTotalVnd,
      })
      .expect(201);

    createdBookingId = res.body.data.id;
    assert.ok(createdBookingId);
    assert.equal(res.body.data.status, 'REQUESTED');
    assert.equal(res.body.data.renterId, renter1Id);
    assert.equal(res.body.data.ownerId, owner1Id);
    assert.equal(res.body.data.pricingSnapshot?.totalVnd, expectedTotalVnd);

    // Security & Privacy: Renter cannot see plateNormalized or pickupAddress while in REQUESTED
    assert.equal(res.body.data.vehicle?.plateNormalized, null);
    assert.equal(res.body.data.vehicle?.pickupAddress, null);

    // Verify calendar hold in PostgreSQL
    const calendarHold = await prisma.vehicleCalendar.findFirst({
      where: {
        vehicleId: testVehicleId,
        bookingId: createdBookingId,
        releasedAt: null,
      },
    });
    assert.ok(calendarHold);
    assert.equal(calendarHold.kind, 'BOOKING');

    // Verify booking event created
    const event = await prisma.bookingEvent.findFirst({
      where: {
        bookingId: createdBookingId,
        eventType: 'BOOKING_REQUESTED',
      },
    });
    assert.ok(event);

    // Verify notification created for owner1
    const notif = await prisma.notification.findFirst({
      where: {
        userId: owner1Id,
        bookingId: createdBookingId,
        type: 'BOOKING_REQUESTED',
      },
    });
    assert.ok(notif);
  });

  it('7. POST /api/v1/bookings replays same Idempotency-Key returning original booking (200 OK)', async () => {
    const idempotencyKey = 'test-key-successful-booking-001';

    const res = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Cookie', renter1Cookies)
      .set('x-csrf-token', renter1Csrf)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        vehicleId: testVehicleId,
        startAt,
        endAt,
        expectedTotalVnd,
      })
      .expect(200);

    assert.equal(res.body.data.id, createdBookingId);
    assert.equal(res.body.data.status, 'REQUESTED');
  });

  it('8. POST /api/v1/bookings rejects same Idempotency-Key with different body (409 IDEMPOTENCY_MISMATCH)', async () => {
    const idempotencyKey = 'test-key-successful-booking-001';

    const res = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Cookie', renter1Cookies)
      .set('x-csrf-token', renter1Csrf)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        vehicleId: testVehicleId,
        startAt,
        endAt: '2026-11-23T18:00:00.000Z', // Different endAt!
        expectedTotalVnd,
      })
      .expect(409);

    assert.equal(res.body.error.code, 'IDEMPOTENCY_MISMATCH');
  });

  it('9. POST /api/v1/bookings rejects overlapping booking on same vehicle (409 VEHICLE_UNAVAILABLE)', async () => {
    // renter2 attempts to book overlapping time
    const res = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Cookie', renter2Cookies)
      .set('x-csrf-token', renter2Csrf)
      .set('Idempotency-Key', 'test-key-overlapping-renter2-001')
      .send({
        vehicleId: testVehicleId,
        startAt,
        endAt,
        expectedTotalVnd,
      })
      .expect(409);

    assert.equal(res.body.error.code, 'VEHICLE_UNAVAILABLE');
  });

  it('10. GET /api/v1/bookings returns list for renter and owner with pagination', async () => {
    // Renter perspective
    const renterList = await request(app.getHttpServer())
      .get('/api/v1/bookings?perspective=renter')
      .set('Cookie', renter1Cookies)
      .expect(200);

    assert.ok(Array.isArray(renterList.body.data));
    assert.ok(renterList.body.data.length >= 1);
    assert.equal(renterList.body.meta.page, 1);

    // Owner perspective
    const ownerList = await request(app.getHttpServer())
      .get('/api/v1/bookings?perspective=owner&status=REQUESTED')
      .set('Cookie', owner1Cookies)
      .expect(200);

    assert.ok(Array.isArray(ownerList.body.data));
    const found = ownerList.body.data.find((b: any) => b.id === createdBookingId);
    assert.ok(found);
  });

  it('11. GET /api/v1/bookings/:id rejects unrelated third-party user (403 FORBIDDEN)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/bookings/${createdBookingId}`)
      .set('Cookie', renter2Cookies)
      .expect(403);

    assert.equal(res.body.error.code, 'FORBIDDEN');
  });

  it('12. POST /api/v1/bookings/:id/approve rejects non-owner (403 FORBIDDEN)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${createdBookingId}/approve`)
      .set('Cookie', renter1Cookies)
      .set('x-csrf-token', renter1Csrf)
      .expect(403);

    assert.equal(res.body.error.code, 'FORBIDDEN');
  });

  it('13. POST /api/v1/bookings/:id/approve owner approves booking -> transitions to APPROVED (200)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${createdBookingId}/approve`)
      .set('Cookie', owner1Cookies)
      .set('x-csrf-token', owner1Csrf)
      .expect(200);

    assert.equal(res.body.data.id, createdBookingId);
    assert.equal(res.body.data.status, 'APPROVED');

    // Renter now fetches booking details: plateNormalized and pickupAddress are REVEALED!
    const renterDetail = await request(app.getHttpServer())
      .get(`/api/v1/bookings/${createdBookingId}`)
      .set('Cookie', renter1Cookies)
      .expect(200);

    assert.equal(renterDetail.body.data.status, 'APPROVED');
    assert.ok(renterDetail.body.data.vehicle?.plateNormalized);
    assert.ok(renterDetail.body.data.vehicle?.pickupAddress);

    // Verify notification sent to renter
    const notif = await prisma.notification.findFirst({
      where: {
        userId: renter1Id,
        bookingId: createdBookingId,
        type: 'BOOKING_APPROVED',
      },
    });
    assert.ok(notif);
  });

  it('14. POST /api/v1/bookings/:id/approve rejects when booking already APPROVED (409 INVALID_TRANSITION)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${createdBookingId}/approve`)
      .set('Cookie', owner1Cookies)
      .set('x-csrf-token', owner1Csrf)
      .expect(409);

    assert.equal(res.body.error.code, 'INVALID_TRANSITION');
  });

  it('15. POST /api/v1/bookings/:id/cancel allows cancelling APPROVED booking and releases calendar', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${createdBookingId}/cancel`)
      .set('Cookie', renter1Cookies)
      .set('x-csrf-token', renter1Csrf)
      .send({
        reason: 'Có việc gia đình đột xuất nên cần hủy chuyến',
      })
      .expect(200);

    assert.equal(res.body.data.status, 'CANCELLED');
    assert.equal(res.body.data.reason, 'Có việc gia đình đột xuất nên cần hủy chuyến');

    // Verify calendar was released in PostgreSQL
    const calendar = await prisma.vehicleCalendar.findFirst({
      where: {
        bookingId: createdBookingId,
      },
    });
    assert.ok(calendar);
    assert.ok(calendar.releasedAt !== null);
  });

  it('16. POST /api/v1/bookings/:id/reject owner rejects REQUESTED booking and frees slot for re-booking', async () => {
    // 1. Create a fresh booking for another window
    const newStart = '2026-11-25T08:00:00.000Z';
    const newEnd = '2026-11-27T18:00:00.000Z';

    const quoteRes = await request(app.getHttpServer())
      .post('/api/v1/pricing/quote')
      .send({
        vehicleId: testVehicleId,
        startAt: newStart,
        endAt: newEnd,
      })
      .expect(200);

    const bookingRes = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Cookie', renter1Cookies)
      .set('x-csrf-token', renter1Csrf)
      .set('Idempotency-Key', 'test-key-to-be-rejected-0001')
      .send({
        vehicleId: testVehicleId,
        startAt: newStart,
        endAt: newEnd,
        expectedTotalVnd: quoteRes.body.data.totalVnd,
      })
      .expect(201);

    const rejectBookingId = bookingRes.body.data.id;

    // 2. Owner rejects booking with reason
    const rejectRes = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${rejectBookingId}/reject`)
      .set('Cookie', owner1Cookies)
      .set('x-csrf-token', owner1Csrf)
      .send({
        reason: 'Xe đã được xếp lịch bảo dưỡng định kỳ',
      })
      .expect(200);

    assert.equal(rejectRes.body.data.status, 'REJECTED');
    assert.equal(rejectRes.body.data.reason, 'Xe đã được xếp lịch bảo dưỡng định kỳ');

    // 3. Verify calendar is released and another user (renter2) CAN now book the exact same slot!
    const rebookRes = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Cookie', renter2Cookies)
      .set('x-csrf-token', renter2Csrf)
      .set('Idempotency-Key', 'test-key-rebooking-slot-0001')
      .send({
        vehicleId: testVehicleId,
        startAt: newStart,
        endAt: newEnd,
        expectedTotalVnd: quoteRes.body.data.totalVnd,
      })
      .expect(201);

    assert.equal(rebookRes.body.data.status, 'REQUESTED');
    assert.notEqual(rebookRes.body.data.id, rejectBookingId);
  });
});
