import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter, TransformInterceptor } from '../src/common';

describe('Media Service & Presigned S3 API (e2e) - G1-03', () => {
  let app: INestApplication;
  let renterSessionCookies: string[];
  let renterCsrfToken: string;
  let ownerSessionCookies: string[];
  let ownerCsrfToken: string;
  let identityMediaId: string;
  let identityUploadUrl: string;
  let vehicleMediaId: string;
  let vehicleUploadUrl: string;

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

    // 1. Login renter1
    const renterLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'renter1@carsharing.local',
        password: 'DemoPassword123!',
      })
      .expect(200);

    renterCsrfToken = renterLogin.body.data.csrfToken;
    const rCookies = renterLogin.headers['set-cookie'] as unknown as string[];
    renterSessionCookies = rCookies.map((c) => (c.split(';')[0] as string) || c);

    // 2. Login owner1
    const ownerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'owner1@carsharing.local',
        password: 'DemoPassword123!',
      })
      .expect(200);

    ownerCsrfToken = ownerLogin.body.data.csrfToken;
    const oCookies = ownerLogin.headers['set-cookie'] as unknown as string[];
    ownerSessionCookies = oCookies.map((c) => (c.split(';')[0] as string) || c);
  });

  after(async () => {
    await app.close();
  });

  it('1. POST /api/v1/media/upload-intents rejects unauthenticated requests (401)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/media/upload-intents')
      .send({
        purpose: 'IDENTITY_DOCUMENT',
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
      })
      .expect(401);
  });

  it('2. POST /api/v1/media/upload-intents rejects invalid MIME type (400 VALIDATION_ERROR)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/media/upload-intents')
      .set('Cookie', renterSessionCookies)
      .set('x-csrf-token', renterCsrfToken)
      .send({
        purpose: 'IDENTITY_DOCUMENT',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
      })
      .expect(400);

    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  it('3. POST /api/v1/media/upload-intents rejects file larger than 5 MiB (400 VALIDATION_ERROR)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/media/upload-intents')
      .set('Cookie', renterSessionCookies)
      .set('x-csrf-token', renterCsrfToken)
      .send({
        purpose: 'IDENTITY_DOCUMENT',
        mimeType: 'image/jpeg',
        sizeBytes: 6 * 1024 * 1024, // 6 MiB > 5 MiB limit
      })
      .expect(400);

    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  it('4. POST /api/v1/media/upload-intents creates valid upload intent for IDENTITY_DOCUMENT', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/media/upload-intents')
      .set('Cookie', renterSessionCookies)
      .set('x-csrf-token', renterCsrfToken)
      .send({
        purpose: 'IDENTITY_DOCUMENT',
        mimeType: 'image/jpeg',
        sizeBytes: 512,
      })
      .expect(201);

    assert.ok(res.body.data.mediaId);
    assert.ok(res.body.data.uploadUrl);
    assert.deepEqual(res.body.data.headers, { 'Content-Type': 'image/jpeg' });
    assert.ok(res.body.data.expiresAt);

    identityMediaId = res.body.data.mediaId;
    identityUploadUrl = res.body.data.uploadUrl;
  });

  it('5. Upload file directly to MinIO via Presigned PUT URL', async () => {
    const dummyImageBuffer = Buffer.from('FAKE_JPEG_IMAGE_BINARY_DATA_TEST_G1_03');
    const uploadRes = await fetch(identityUploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'image/jpeg',
      },
      body: dummyImageBuffer,
    });

    assert.equal(uploadRes.status, 200);
  });

  it('6. POST /api/v1/media/:id/verify probes S3 and moves file to finalized (200 OK)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/media/${identityMediaId}/verify`)
      .set('Cookie', renterSessionCookies)
      .set('x-csrf-token', renterCsrfToken)
      .expect(200);

    assert.equal(res.body.data.id, identityMediaId);
    assert.equal(res.body.data.state, 'VERIFIED');
    assert.ok(res.body.data.verifiedAt);
  });

  it('7. GET /api/v1/media/:id/read-url allows uploader to view IDENTITY_DOCUMENT', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/media/${identityMediaId}/read-url`)
      .set('Cookie', renterSessionCookies)
      .expect(200);

    assert.ok(res.body.data.url);
    assert.ok(res.body.data.url.includes('car-sharing-private'));
    assert.ok(res.body.data.url.includes('finalized/identity_document/'));
  });

  it('8. GET /api/v1/media/:id/read-url rejects other user from viewing IDENTITY_DOCUMENT (403 FORBIDDEN)', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/media/${identityMediaId}/read-url`)
      .set('Cookie', ownerSessionCookies)
      .expect(403);
  });

  it('9. GET /api/v1/media/:id/read-url rejects anonymous user from viewing IDENTITY_DOCUMENT (403 FORBIDDEN)', async () => {
    await request(app.getHttpServer()).get(`/api/v1/media/${identityMediaId}/read-url`).expect(403);
  });

  it('10. VEHICLE_PHOTO allows public access to read-url after upload and verification', async () => {
    // 1. Create upload intent
    const intentRes = await request(app.getHttpServer())
      .post('/api/v1/media/upload-intents')
      .set('Cookie', ownerSessionCookies)
      .set('x-csrf-token', ownerCsrfToken)
      .send({
        purpose: 'VEHICLE_PHOTO',
        mimeType: 'image/png',
        sizeBytes: 256,
      })
      .expect(201);

    vehicleMediaId = intentRes.body.data.mediaId;
    vehicleUploadUrl = intentRes.body.data.uploadUrl;

    // 2. Upload dummy PNG to MinIO
    const uploadRes = await fetch(vehicleUploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'image/png',
      },
      body: Buffer.from('FAKE_PNG_IMAGE_BINARY_DATA'),
    });
    assert.equal(uploadRes.status, 200);

    // 3. Verify
    await request(app.getHttpServer())
      .post(`/api/v1/media/${vehicleMediaId}/verify`)
      .set('Cookie', ownerSessionCookies)
      .set('x-csrf-token', ownerCsrfToken)
      .expect(200);

    // 4. Anonymous read-url succeeds
    const publicRead = await request(app.getHttpServer())
      .get(`/api/v1/media/${vehicleMediaId}/read-url`)
      .expect(200);

    assert.ok(publicRead.body.data.url);
    assert.ok(publicRead.body.data.url.includes('finalized/vehicle_photo/'));
  });
});
