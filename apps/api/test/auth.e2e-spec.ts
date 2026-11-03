import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter, TransformInterceptor } from '../src/common';

describe('Auth API (e2e) - G1-01', () => {
  let app: INestApplication;
  let csrfToken: string;
  let sessionCookies: string[];

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
  });

  after(async () => {
    await app.close();
  });

  it('1. GET /api/v1/auth/csrf returns 200 and sets csrf_token cookie', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/auth/csrf').expect(200);

    assert.ok(res.body.data.csrfToken, 'Should return csrfToken in data wrapper');
    csrfToken = res.body.data.csrfToken;

    const cookies = res.headers['set-cookie'] as unknown as string[];
    assert.ok(cookies, 'Set-Cookie header should be present');
    const csrfCookieHeader = cookies.find((c) => c.startsWith('csrf_token='));
    assert.ok(csrfCookieHeader, 'csrf_token cookie should be set');
  });

  it('2. POST /api/v1/auth/login successfully logs in seed user and sets HttpOnly session cookies', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'owner1@carsharing.local',
        password: 'DemoPassword123!',
      })
      .expect(200);

    assert.equal(res.body.data.user.email, 'owner1@carsharing.local');
    assert.equal(res.body.data.user.name, 'Chủ 1');
    assert.deepEqual(res.body.data.user.capabilities, ['RENTER', 'OWNER'], 'Capability model');
    assert.ok(res.body.data.csrfToken);

    const cookies = res.headers['set-cookie'] as unknown as string[];
    assert.ok(cookies, 'Set-Cookie header should be present');

    const accessTokenCookie = cookies.find((c) => c.startsWith('access_token='));
    assert.ok(accessTokenCookie, 'access_token cookie should be set');
    assert.ok(accessTokenCookie.includes('HttpOnly'), 'access_token must be HttpOnly');

    const refreshTokenCookie = cookies.find((c) => c.startsWith('refresh_token='));
    assert.ok(refreshTokenCookie, 'refresh_token cookie should be set');
    assert.ok(refreshTokenCookie.includes('HttpOnly'), 'refresh_token must be HttpOnly');

    sessionCookies = cookies.map((c) => (c.split(';')[0] as string) || c);
  });

  it('3. POST /api/v1/auth/login rejects incorrect password with 401 INVALID_CREDENTIALS', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'owner1@carsharing.local',
        password: 'WrongPassword!',
      })
      .expect(401);

    assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
  });

  it('4. POST /api/v1/auth/login rejects invalid email format with 400 VALIDATION_ERROR', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'not-an-email',
        password: 'SomePassword123!',
      })
      .expect(400);

    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  it('5. GET /api/v1/auth/me rejects unauthenticated request with 401 UNAUTHORIZED', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);

    assert.equal(res.body.error.code, 'UNAUTHORIZED');
  });

  it('6. GET /api/v1/auth/me returns 200 with user profile when session cookie is provided', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', sessionCookies)
      .expect(200);

    assert.equal(res.body.data.email, 'owner1@carsharing.local');
    assert.equal(res.body.data.name, 'Chủ 1');
    assert.deepEqual(res.body.data.capabilities, ['RENTER', 'OWNER']);
  });

  it('7. GET /api/v1/me (alias route) also returns user profile', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Cookie', sessionCookies)
      .expect(200);

    assert.equal(res.body.data.email, 'owner1@carsharing.local');
  });

  it('8. POST /api/v1/auth/register creates new user account and returns session', async () => {
    const uniqueEmail = `newuser_${Date.now()}@carsharing.local`;
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        name: 'Mới 1',
        email: uniqueEmail,
        password: 'ValidPassword123!',
        phone: '0912345678',
      })
      .expect(201);

    assert.equal(res.body.data.user.email, uniqueEmail);
    assert.equal(res.body.data.user.name, 'Mới 1');
    assert.deepEqual(res.body.data.user.capabilities, ['RENTER', 'OWNER']);

    // Registering the exact same email again must return 409 EMAIL_IN_USE
    const duplicateRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        name: 'Mới 2',
        email: uniqueEmail,
        password: 'ValidPassword123!',
        phone: '0912345679',
      })
      .expect(409);

    assert.equal(duplicateRes.body.error.code, 'EMAIL_IN_USE');
  });

  it('9. POST /api/v1/auth/logout rejects when CSRF token is missing (403 CSRF_INVALID)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', sessionCookies)
      .expect(403);

    assert.equal(res.body.error.code, 'CSRF_INVALID');
  });

  it('10. POST /api/v1/auth/logout succeeds with 204 when valid session and CSRF token provided', async () => {
    // Lấy CSRF token và cookie hiện tại
    const csrfCookieHeader = sessionCookies.find((c) => c.startsWith('csrf_token='));
    const tokenValue = (csrfCookieHeader ? csrfCookieHeader.split('=')[1] : csrfToken) || csrfToken;

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', sessionCookies)
      .set('X-CSRF-Token', tokenValue)
      .expect(204);

    const clearedCookies = res.headers['set-cookie'] as unknown as string[];
    assert.ok(clearedCookies, 'Should return Set-Cookie clearing session');
    assert.ok(
      clearedCookies.some((c) => c.includes('access_token=;')),
      'access_token should be cleared',
    );
  });

  it('11. GET /api/v1/auth/google redirects to callback or provider', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/google').expect(302);
  });

  it('12. GET /api/v1/auth/google/callback processes mock code and redirects to web', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/google/callback?code=mock_google_code_seed_owner&state=mock')
      .expect(302);

    const cookies = res.headers['set-cookie'] as unknown as string[];
    assert.ok(cookies.some((c) => c.startsWith('access_token=')));
  });
});
