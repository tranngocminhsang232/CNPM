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
import { BookingStatus } from '@prisma/client';

describe('Two-Way Reviews API (e2e) - G5-03', () => {
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

    // 5. Create test booking in IN_PROGRESS initially
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
  });

  after(async () => {
    // Cleanup
    await prisma.review.deleteMany({ where: { bookingId: testBookingId } });
    await prisma.notification.deleteMany({ where: { bookingId: testBookingId } });
    await prisma.bookingEvent.deleteMany({ where: { bookingId: testBookingId } });
    await prisma.booking.deleteMany({ where: { id: testBookingId } });
    await app.close();
  });

  it('1. POST /api/v1/bookings/:id/reviews rejects unauthenticated (401)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/bookings/${testBookingId}/reviews`)
      .send({ score: 5, comment: 'Rất tốt' })
      .expect(401);
  });

  it('2. POST /api/v1/bookings/:id/reviews rejects stranger (403 FORBIDDEN)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${testBookingId}/reviews`)
      .set('Cookie', renter2Cookies)
      .set('x-csrf-token', renter2Csrf)
      .send({ score: 5, comment: 'Rất tốt' })
      .expect(403);

    assert.equal(res.body.error?.code, 'FORBIDDEN');
  });

  it('3. POST /api/v1/bookings/:id/reviews rejects 409 INVALID_BOOKING_STATUS when booking is still IN_PROGRESS', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${testBookingId}/reviews`)
      .set('Cookie', renter1Cookies)
      .set('x-csrf-token', renter1Csrf)
      .send({ score: 5, comment: 'Rất tốt' })
      .expect(409);

    assert.equal(res.body.error?.code, 'INVALID_BOOKING_STATUS');
  });

  it('4. POST /api/v1/bookings/:id/reviews validates score range 1-5 and comment requirement (400)', async () => {
    // Score > 5
    await request(app.getHttpServer())
      .post(`/api/v1/bookings/${testBookingId}/reviews`)
      .set('Cookie', renter1Cookies)
      .set('x-csrf-token', renter1Csrf)
      .send({ score: 6, comment: 'Rất tốt' })
      .expect(400);

    // Score < 1
    await request(app.getHttpServer())
      .post(`/api/v1/bookings/${testBookingId}/reviews`)
      .set('Cookie', renter1Cookies)
      .set('x-csrf-token', renter1Csrf)
      .send({ score: 0, comment: 'Rất tốt' })
      .expect(400);

    // Missing comment
    await request(app.getHttpServer())
      .post(`/api/v1/bookings/${testBookingId}/reviews`)
      .set('Cookie', renter1Cookies)
      .set('x-csrf-token', renter1Csrf)
      .send({ score: 5 })
      .expect(400);
  });

  it('5. Renter submits 5-star review on COMPLETED booking', async () => {
    // Transition booking to COMPLETED
    await prisma.booking.update({
      where: { id: testBookingId },
      data: { status: BookingStatus.COMPLETED, completedAt: new Date() },
    });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${testBookingId}/reviews`)
      .set('Cookie', renter1Cookies)
      .set('x-csrf-token', renter1Csrf)
      .send({
        score: 5,
        comment: 'Xe VinFast VF8 lái rất bốc và đầm chắc, sạc nhanh, chủ xe hướng dẫn chu đáo!',
      })
      .expect(201);

    assert.equal(res.body.data.score, 5);
    assert.equal(res.body.data.authorId, renter1Id);
    assert.equal(res.body.data.targetUserId, owner1Id);
    assert.ok(res.body.data.id);

    // Verify DB
    const review = await prisma.review.findUnique({
      where: {
        bookingId_authorId: {
          bookingId: testBookingId,
          authorId: renter1Id,
        },
      },
    });
    assert.ok(review);
    assert.equal(review.score, 5);
    assert.equal(review.targetUserId, owner1Id);

    // Verify Notification for owner
    const notif = await prisma.notification.findFirst({
      where: { bookingId: testBookingId, userId: owner1Id, type: 'REVIEW_RECEIVED' },
    });
    assert.ok(notif);
  });

  it('6. Renter attempts to submit a second review on the same booking (rejects 409 ALREADY_REVIEWED)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${testBookingId}/reviews`)
      .set('Cookie', renter1Cookies)
      .set('x-csrf-token', renter1Csrf)
      .send({ score: 4, comment: 'Muốn sửa điểm' })
      .expect(409);

    assert.equal(res.body.error?.code, 'ALREADY_REVIEWED');
  });

  it('7. Owner submits 4-star review for renter', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${testBookingId}/reviews`)
      .set('Cookie', owner1Cookies)
      .set('x-csrf-token', owner1Csrf)
      .send({
        score: 4,
        comment: 'Khách thuê giữ xe sạch sẽ, trả xe đúng giờ quy định!',
      })
      .expect(201);

    assert.equal(res.body.data.score, 4);
    assert.equal(res.body.data.authorId, owner1Id);
    assert.equal(res.body.data.targetUserId, renter1Id);

    // Verify Notification for renter
    const notif = await prisma.notification.findFirst({
      where: { bookingId: testBookingId, userId: renter1Id, type: 'REVIEW_RECEIVED' },
    });
    assert.ok(notif);
  });

  it('8. GET /api/v1/bookings/:id/reviews returns both reviews for participants', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/bookings/${testBookingId}/reviews`)
      .set('Cookie', renter1Cookies)
      .expect(200);

    assert.equal(res.body.data.length, 2);
    const scores = res.body.data.map((r: any) => r.score);
    assert.ok(scores.includes(5));
    assert.ok(scores.includes(4));
  });

  it('9. GET /api/v1/vehicles/:id/reviews returns public vehicle rating and renter reviews', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/vehicles/${vehicleId}/reviews`)
      .expect(200);

    assert.ok(res.body.data.totalReviews >= 1);
    assert.ok(res.body.data.averageScore >= 1 && res.body.data.averageScore <= 5);
    // Make sure all reviews returned are authored by renters
    for (const r of res.body.data.reviews) {
      assert.notEqual(
        r.authorId,
        owner1Id,
        'Đánh giá xe không được bao gồm đánh giá của chủ xe viết cho khách',
      );
    }
  });
});
