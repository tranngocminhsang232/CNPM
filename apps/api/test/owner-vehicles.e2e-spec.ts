import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter, TransformInterceptor } from '../src/common';

describe('Owner Vehicles CRUD API (e2e) - G1-04', () => {
  let app: INestApplication;
  let owner1Cookies: string[];
  let owner1Csrf: string;
  let owner2Cookies: string[];
  let owner2Csrf: string;
  let createdVehicleId: string;
  let verifiedMediaId: string;

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

    // 1. Login owner1
    const owner1Login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'owner1@carsharing.local',
        password: 'DemoPassword123!',
      })
      .expect(200);

    owner1Csrf = owner1Login.body.data.csrfToken;
    const o1Cookies = owner1Login.headers['set-cookie'] as unknown as string[];
    owner1Cookies = o1Cookies.map((c) => (c.split(';')[0] as string) || c);

    // 2. Login owner2
    const owner2Login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'owner2@carsharing.local',
        password: 'DemoPassword123!',
      })
      .expect(200);

    owner2Csrf = owner2Login.body.data.csrfToken;
    const o2Cookies = owner2Login.headers['set-cookie'] as unknown as string[];
    owner2Cookies = o2Cookies.map((c) => (c.split(';')[0] as string) || c);

    // 3. Upload and verify a vehicle photo for owner1 to use in publish test
    const intentRes = await request(app.getHttpServer())
      .post('/api/v1/media/upload-intents')
      .set('Cookie', owner1Cookies)
      .set('x-csrf-token', owner1Csrf)
      .send({
        purpose: 'VEHICLE_PHOTO',
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
      })
      .expect(201);

    verifiedMediaId = intentRes.body.data.mediaId;
    const uploadUrl = intentRes.body.data.uploadUrl;

    await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: Buffer.from('TEST_JPEG_DATA_OWNER_VEHICLE'),
    });

    await request(app.getHttpServer())
      .post(`/api/v1/media/${verifiedMediaId}/verify`)
      .set('Cookie', owner1Cookies)
      .set('x-csrf-token', owner1Csrf)
      .expect(200);

    // Dọn dẹp dữ liệu test cũ để bảo đảm tính độc lập
    const { PrismaService } = await import('../src/prisma/prisma.service');
    const prisma = app.get(PrismaService);
    await prisma.vehicle.deleteMany({
      where: { plateNormalized: { in: ['51K-77777', '51K-88888'] } },
    });
  });

  after(async () => {
    // Dọn dẹp xe test sau khi chạy xong để không làm sai lệch số lượng xe của seed
    const { PrismaService } = await import('../src/prisma/prisma.service');
    const prisma = app.get(PrismaService);
    await prisma.vehicle.deleteMany({
      where: { plateNormalized: { in: ['51K-77777', '51K-88888'] } },
    });
    await app.close();
  });

  it('1. POST /api/v1/owner/vehicles rejects unauthenticated requests (401)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/owner/vehicles')
      .send({
        brand: 'VinFast',
        model: 'VF8',
        year: 2023,
        licensePlate: '51K-888.88',
        city: 'TP. Hồ Chí Minh',
        pickupAddress: '72 Lê Thánh Tôn, Bến Nghé, Quận 1',
        carType: 'SUV',
        transmission: 'AUTO',
        seats: 5,
        description: 'Xe điện cao cấp, sạc miễn phí.',
        pricePerDayVnd: 1500000,
      })
      .expect(401);
  });

  it('2. POST /api/v1/owner/vehicles rejects invalid price outside [100k, 100M] VND (400)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/owner/vehicles')
      .set('Cookie', owner1Cookies)
      .set('x-csrf-token', owner1Csrf)
      .send({
        brand: 'VinFast',
        model: 'VF8',
        year: 2023,
        licensePlate: '51K-888.88',
        city: 'TP. Hồ Chí Minh',
        pickupAddress: '72 Lê Thánh Tôn, Bến Nghé, Quận 1',
        carType: 'SUV',
        transmission: 'AUTO',
        seats: 5,
        description: 'Xe điện cao cấp.',
        pricePerDayVnd: 50000, // < 100.000 VND
      })
      .expect(400);

    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  it('3. POST /api/v1/owner/vehicles creates vehicle in DRAFT status (201 Created)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/owner/vehicles')
      .set('Cookie', owner1Cookies)
      .set('x-csrf-token', owner1Csrf)
      .send({
        brand: 'VinFast',
        model: 'VF8 Plus',
        year: 2024,
        licensePlate: '51K-777.77',
        city: 'TP. Hồ Chí Minh',
        pickupAddress: '72 Lê Thánh Tôn, Bến Nghé, Quận 1',
        carType: 'SUV',
        transmission: 'AUTO',
        seats: 5,
        description: 'Xe điện thông minh, hỗ trợ tự lái ADAS, êm ái tiện nghi.',
        pricePerDayVnd: 1600000,
        keylessSupported: true,
        amenities: ['GPS', 'BLUETOOTH', 'BACKUP_CAMERA', 'ETC'],
      })
      .expect(201);

    assert.ok(res.body.data.id);
    assert.equal(res.body.data.brand, 'VinFast');
    assert.equal(res.body.data.model, 'VF8 Plus');
    assert.equal(res.body.data.plateNormalized, '51K-77777');
    assert.equal(res.body.data.status, 'DRAFT');
    assert.equal(res.body.data.version, 1);
    assert.equal(res.body.data.pricePerDayVnd, 1600000);
    assert.deepEqual(res.body.data.amenities, ['GPS', 'BLUETOOTH', 'BACKUP_CAMERA', 'ETC']);

    createdVehicleId = res.body.data.id;
  });

  it('4. POST /api/v1/owner/vehicles rejects duplicate license plate with 409 CONFLICT', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/owner/vehicles')
      .set('Cookie', owner2Cookies)
      .set('x-csrf-token', owner2Csrf)
      .send({
        brand: 'VinFast',
        model: 'VF8 Eco',
        year: 2023,
        licensePlate: '51K77777', // Same normalized plate
        city: 'TP. Hồ Chí Minh',
        pickupAddress: '99 CMT8, Quận 3',
        carType: 'SUV',
        transmission: 'AUTO',
        seats: 5,
        description: 'Trùng biển số xe đã đăng ký.',
        pricePerDayVnd: 1500000,
      })
      .expect(409);

    assert.equal(res.body.error.code, 'CONFLICT');
  });

  it('5. GET /api/v1/owner/vehicles returns vehicles owned by current user', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/owner/vehicles')
      .set('Cookie', owner1Cookies)
      .expect(200);

    assert.ok(Array.isArray(res.body.data));
    const found = res.body.data.find((v: any) => v.id === createdVehicleId);
    assert.ok(found);
    assert.equal(found.pickupAddress, '72 Lê Thánh Tôn, Bến Nghé, Quận 1');
    assert.equal(found.plateNormalized, '51K-77777');
  });

  it('6. GET /api/v1/owner/vehicles/:id rejects owner2 from viewing owner1 vehicle (403 FORBIDDEN)', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/owner/vehicles/${createdVehicleId}`)
      .set('Cookie', owner2Cookies)
      .expect(403);
  });

  it('7. POST /api/v1/owner/vehicles/:id/publish rejects when vehicle has 0 photos (422)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/owner/vehicles/${createdVehicleId}/publish`)
      .set('Cookie', owner1Cookies)
      .set('x-csrf-token', owner1Csrf)
      .expect(422);

    assert.equal(res.body.error.code, 'PUBLISH_REQUIREMENTS_NOT_MET');
  });

  it('8. PATCH /api/v1/owner/vehicles/:id updates vehicle and attaches verified photo', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/owner/vehicles/${createdVehicleId}`)
      .set('Cookie', owner1Cookies)
      .set('x-csrf-token', owner1Csrf)
      .send({
        pricePerDayVnd: 1700000,
        photoMediaIds: [verifiedMediaId],
      })
      .expect(200);

    assert.equal(res.body.data.pricePerDayVnd, 1700000);
    assert.equal(res.body.data.photos.length, 1);
    assert.equal(res.body.data.photos[0].mediaId, verifiedMediaId);
    assert.equal(res.body.data.version, 2);
  });

  it('9. POST /api/v1/owner/vehicles/:id/publish succeeds after attaching photo (200 OK)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/owner/vehicles/${createdVehicleId}/publish`)
      .set('Cookie', owner1Cookies)
      .set('x-csrf-token', owner1Csrf)
      .expect(200);

    assert.equal(res.body.data.status, 'PUBLISHED');
    assert.equal(res.body.data.version, 3);
  });

  it('10. Newly published vehicle appears on public GET /api/v1/vehicles without leaking private fields', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/vehicles?city=TP.%20H%E1%BB%93%20Ch%C3%AD%20Minh')
      .expect(200);

    const published = res.body.data.find((v: any) => v.id === createdVehicleId);
    assert.ok(published);
    assert.equal(published.brand, 'VinFast');
    assert.equal(published.model, 'VF8 Plus');
    assert.equal(published.pricePerDayVnd, 1700000);
    assert.equal(published.plateNormalized, undefined);
    assert.equal(published.pickupAddress, undefined);
  });
});
