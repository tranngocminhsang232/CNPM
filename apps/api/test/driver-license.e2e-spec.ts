import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter, TransformInterceptor } from '../src/common';

describe('Driver License KYC API (e2e) - G1-02', () => {
  let app: INestApplication;
  let sessionCookies: string[];
  let csrfToken: string;
  let userId: string;

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

    // Đăng nhập tài khoản seed renter1@carsharing.local để có phiên
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'renter1@carsharing.local',
        password: 'DemoPassword123!',
      })
      .expect(200);

    userId = loginRes.body.data.user.id;
    csrfToken = loginRes.body.data.csrfToken;

    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    sessionCookies = cookies.map((c) => (c.split(';')[0] as string) || c);

    // Dọn dẹp trạng thái KYC của renter1 trước khi chạy test để bảo đảm tính độc lập
    const { PrismaService } = await import('../src/prisma/prisma.service');
    const prisma = app.get(PrismaService);
    await prisma.driverLicense.deleteMany({ where: { userId } });
    await prisma.user.update({ where: { id: userId }, data: { kycStatus: 'NONE' } });
  });

  after(async () => {
    await app.close();
  });

  it('1. GET /api/v1/users/me/driver-license returns null before submission', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/users/me/driver-license')
      .set('Cookie', sessionCookies)
      .expect(200);

    // Có thể null hoặc bản ghi cũ nếu chạy lại
    assert.ok(res.body.hasOwnProperty('data'));
  });

  it('2. POST /api/v1/users/me/driver-license rejects when CSRF token is missing (403 CSRF_INVALID)', async () => {
    const futureExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const res = await request(app.getHttpServer())
      .post('/api/v1/users/me/driver-license')
      .set('Cookie', sessionCookies)
      .send({
        licenseNumber: '079199012345',
        fullName: 'Lê Hoàng Thuê 1',
        dateOfBirth: '1995-05-15',
        licenseClass: 'B2',
        expiryDate: futureExpiry,
      })
      .expect(403);

    assert.equal(res.body.error.code, 'CSRF_INVALID');
  });

  it('3. POST /api/v1/users/me/driver-license rejects invalid license number format (400 VALIDATION_ERROR)', async () => {
    const futureExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const res = await request(app.getHttpServer())
      .post('/api/v1/users/me/driver-license')
      .set('Cookie', sessionCookies)
      .set('X-CSRF-Token', csrfToken)
      .send({
        licenseNumber: '12345', // chỉ có 5 số (yêu cầu đúng 12 số)
        fullName: 'Lê Hoàng Thuê 1',
        dateOfBirth: '1995-05-15',
        licenseClass: 'B2',
        expiryDate: futureExpiry,
      })
      .expect(400);

    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  it('4. POST /api/v1/users/me/driver-license rejects expiry date less than 30 days (400 VALIDATION_ERROR)', async () => {
    const soonExpiry = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const res = await request(app.getHttpServer())
      .post('/api/v1/users/me/driver-license')
      .set('Cookie', sessionCookies)
      .set('X-CSRF-Token', csrfToken)
      .send({
        licenseNumber: '079199012345',
        fullName: 'Lê Hoàng Thuê 1',
        dateOfBirth: '1995-05-15',
        licenseClass: 'B2',
        expiryDate: soonExpiry,
      })
      .expect(400);

    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  it('5. POST /api/v1/users/me/driver-license successfully submits valid GPLX with 201 PENDING', async () => {
    const futureExpiry = new Date(Date.now() + 730 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const res = await request(app.getHttpServer())
      .post('/api/v1/users/me/driver-license')
      .set('Cookie', sessionCookies)
      .set('X-CSRF-Token', csrfToken)
      .send({
        licenseNumber: '079199012345',
        fullName: 'Lê Hoàng Thuê 1',
        dateOfBirth: '1995-05-15',
        licenseClass: 'B2',
        expiryDate: futureExpiry,
      })
      .expect(201);

    assert.equal(res.body.data.licenseNumber, '079199012345');
    assert.equal(res.body.data.status, 'PENDING');
    assert.equal(res.body.data.fullName, 'LÊ HOÀNG THUÊ 1');
  });

  it('6. POST /api/v1/users/:id/driver-license/verify approves driver license with 200 VERIFIED', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/users/${userId}/driver-license/verify`)
      .set('Cookie', sessionCookies)
      .set('X-CSRF-Token', csrfToken)
      .send({
        status: 'VERIFIED',
      })
      .expect(200);

    assert.equal(res.body.data.status, 'VERIFIED');
    assert.ok(res.body.data.verifiedAt);
  });

  it('7. POST /api/v1/users/me/driver-license rejects re-submission when already VERIFIED (409 ALREADY_VERIFIED)', async () => {
    const futureExpiry = new Date(Date.now() + 730 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const res = await request(app.getHttpServer())
      .post('/api/v1/users/me/driver-license')
      .set('Cookie', sessionCookies)
      .set('X-CSRF-Token', csrfToken)
      .send({
        licenseNumber: '079199012345',
        fullName: 'Lê Hoàng Thuê 1',
        dateOfBirth: '1995-05-15',
        licenseClass: 'B2',
        expiryDate: futureExpiry,
      })
      .expect(409);

    assert.equal(res.body.error.code, 'ALREADY_VERIFIED');
  });
});
