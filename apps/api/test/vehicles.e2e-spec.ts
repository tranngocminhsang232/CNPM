import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NestFactory } from '@nestjs/core';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter, TransformInterceptor } from '../src/common';

describe('Vehicles API (e2e) - G0-09', () => {
  let app: INestApplication;

  before(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
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

  // ---------------------------------------------------------------------------
  // 1. GET /api/v1/vehicle-options
  // ---------------------------------------------------------------------------
  describe('GET /api/v1/vehicle-options', () => {
    it('returns 200 with standard search allowlists (cities, carTypes, transmissions, amenities)', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/vehicle-options').expect(200);

      assert.ok(res.body.data);
      const { cities, carTypes, transmissions, amenities } = res.body.data;
      assert.ok(cities.includes('TP. Hồ Chí Minh'));
      assert.ok(cities.includes('Hà Nội'));
      assert.ok(cities.includes('Đà Nẵng'));
      assert.ok(carTypes.includes('SUV'));
      assert.ok(transmissions.includes('AUTO'));
      assert.ok(amenities.some((a: any) => a.code === 'GPS' && a.name === 'Định vị GPS'));
    });
  });

  // ---------------------------------------------------------------------------
  // 2. GET /api/v1/vehicles
  // ---------------------------------------------------------------------------
  describe('GET /api/v1/vehicles', () => {
    it('returns 200 with published vehicles and pagination meta (excludes DRAFT)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/vehicles?page=1&pageSize=20')
        .expect(200);

      assert.ok(res.body.data);
      assert.ok(Array.isArray(res.body.data));
      assert.equal(res.body.meta.total, 12); // Exactly 12 PUBLISHED, 1 DRAFT excluded!

      // Confirm no DRAFT vehicle in the list
      const platesOrDraft = res.body.data.find(
        (v: any) => v.id === '10000000-0000-0000-0000-000000000013',
      );
      assert.equal(platesOrDraft, undefined);
    });

    it('strictly hides private fields (plateNormalized, pickupAddress) from public results', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/vehicles?pageSize=5').expect(200);

      assert.ok(res.body.data.length > 0);
      for (const vehicle of res.body.data) {
        assert.equal(vehicle.plateNormalized, undefined);
        assert.equal(vehicle.plate, undefined);
        assert.equal(vehicle.pickupAddress, undefined);
        assert.equal(vehicle.address, undefined);
        assert.equal(typeof vehicle.pricePerDayVnd, 'number'); // Safe JS number
        assert.ok(vehicle.brand && vehicle.model && vehicle.city);
      }
    });

    it('filters vehicles by city', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/vehicles?city=Hà%20Nội')
        .expect(200);

      assert.equal(res.body.meta.total, 4);
      for (const v of res.body.data) {
        assert.equal(v.city, 'Hà Nội');
      }
    });

    it('filters vehicles by carType', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/vehicles?carType=MPV')
        .expect(200);

      assert.ok(res.body.meta.total >= 2);
      for (const v of res.body.data) {
        assert.equal(v.carType, 'MPV');
      }
    });

    it('filters vehicles by keylessOnly', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/vehicles?keylessOnly=true')
        .expect(200);

      assert.ok(res.body.meta.total > 0);
      for (const v of res.body.data) {
        assert.equal(v.keylessSupported, true);
      }
    });

    it('returns empty array with meta when city has no vehicles', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/vehicles?city=Huế').expect(200);

      assert.deepEqual(res.body.data, []);
      assert.equal(res.body.meta.total, 0);
      assert.equal(res.body.meta.page, 1);
    });

    it('rejects query with startAt missing endAt with 400 VALIDATION_ERROR', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/vehicles?startAt=2026-11-01T08:00:00Z')
        .expect(400);

      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    });

    it('rejects query with endAt <= startAt with 400 VALIDATION_ERROR', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/vehicles?startAt=2026-11-05T18:00:00Z&endAt=2026-11-05T08:00:00Z')
        .expect(400);

      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    });

    it('excludes vehicles that have calendar conflict in the requested range', async () => {
      // Vehicle 3 has an APPROVED booking in [now + 2 days, now + 4 days]
      // (see seed.ts DEMO_IDS.BOOKINGS.APPROVED)
      const now = new Date();
      const dayMs = 24 * 3600 * 1000;
      const startAt = new Date(now.getTime() + 2.5 * dayMs).toISOString();
      const endAt = new Date(now.getTime() + 3.5 * dayMs).toISOString();

      const res = await request(app.getHttpServer())
        .get(
          `/api/v1/vehicles?startAt=${encodeURIComponent(startAt)}&endAt=${encodeURIComponent(endAt)}`,
        )
        .expect(200);

      // Vehicle 3 should NOT be in the results because of active calendar overlap
      const v3 = res.body.data.find((v: any) => v.id === '10000000-0000-0000-0000-000000000003');
      assert.equal(v3, undefined);

      // Other vehicles without conflict are included
      assert.ok(res.body.data.length > 0);
      // All returned vehicles should include quote
      assert.ok(res.body.data[0].quote);
      assert.ok(res.body.data[0].quote.totalVnd > 0);
    });
  });
});
