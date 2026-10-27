import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NestFactory } from '@nestjs/core';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter, TransformInterceptor } from '../src/common';

describe('Vehicles Advanced Search & Detail API (e2e) - G2-01', () => {
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
  // 1. Advanced Search Filters
  // ---------------------------------------------------------------------------
  describe('GET /api/v1/vehicles (Advanced Filters)', () => {
    it('1. filters vehicles by keyword q matching brand or model', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/vehicles?q=VinFast').expect(200);

      assert.ok(res.body.data.length > 0);
      for (const v of res.body.data) {
        assert.ok(
          v.brand.toLowerCase().includes('vinfast') || v.model.toLowerCase().includes('vinfast'),
        );
      }
    });

    it('2. filters vehicles by specific brand', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/vehicles?brand=Toyota')
        .expect(200);

      assert.ok(res.body.data.length > 0);
      for (const v of res.body.data) {
        assert.equal(v.brand, 'Toyota');
      }
    });

    it('3. filters vehicles within price range [minPrice, maxPrice]', async () => {
      const minPrice = 1000000;
      const maxPrice = 1500000;
      const res = await request(app.getHttpServer())
        .get(`/api/v1/vehicles?minPrice=${minPrice}&maxPrice=${maxPrice}`)
        .expect(200);

      assert.ok(res.body.data.length > 0);
      for (const v of res.body.data) {
        assert.ok(v.pricePerDayVnd >= minPrice);
        assert.ok(v.pricePerDayVnd <= maxPrice);
      }
    });

    it('4. filters vehicles by required amenities (GPS and BLUETOOTH)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/vehicles?amenities=GPS,BLUETOOTH')
        .expect(200);

      assert.ok(res.body.data.length > 0);
      for (const v of res.body.data) {
        assert.ok(v.amenities.includes('GPS'));
        assert.ok(v.amenities.includes('BLUETOOTH'));
      }
    });

    it('5. sorts vehicles by price_asc', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/vehicles?sort=price_asc&pageSize=20')
        .expect(200);

      assert.ok(res.body.data.length > 1);
      for (let i = 0; i < res.body.data.length - 1; i++) {
        assert.ok(res.body.data[i].pricePerDayVnd <= res.body.data[i + 1].pricePerDayVnd);
      }
    });

    it('6. sorts vehicles by price_desc', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/vehicles?sort=price_desc&pageSize=20')
        .expect(200);

      assert.ok(res.body.data.length > 1);
      for (let i = 0; i < res.body.data.length - 1; i++) {
        assert.ok(res.body.data[i].pricePerDayVnd >= res.body.data[i + 1].pricePerDayVnd);
      }
    });

    it('7. sorts vehicles by popularity_desc', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/vehicles?sort=popularity_desc&pageSize=5')
        .expect(200);

      assert.ok(res.body.data.length > 0);
      assert.equal(res.status, 200);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. GET /api/v1/vehicles/:id (Public Detail)
  // ---------------------------------------------------------------------------
  describe('GET /api/v1/vehicles/:id', () => {
    it('8. returns 200 with vehicle details without leaking private plate or address', async () => {
      const vehicleId = '10000000-0000-0000-0000-000000000001';
      const res = await request(app.getHttpServer())
        .get(`/api/v1/vehicles/${vehicleId}`)
        .expect(200);

      const v = res.body.data;
      assert.equal(v.id, vehicleId);
      assert.ok(v.brand);
      assert.ok(v.model);
      assert.ok(v.year);
      assert.ok(v.city);
      assert.ok(v.pricePerDayVnd > 0);
      assert.ok(Array.isArray(v.amenities));
      assert.ok(Array.isArray(v.photoUrls));
      assert.ok(v.owner);
      assert.ok(v.owner.id);
      assert.ok(v.owner.name);

      // Strict privacy checks: NO plate, NO pickupAddress, NO owner contact
      assert.equal(v.plateNormalized, undefined);
      assert.equal(v.plate, undefined);
      assert.equal(v.pickupAddress, undefined);
      assert.equal(v.address, undefined);
      assert.equal(v.owner.emailNormalized, undefined);
      assert.equal(v.owner.phone, undefined);
    });

    it('9. returns 404 NOT_FOUND for DRAFT vehicle', async () => {
      const draftVehicleId = '10000000-0000-0000-0000-000000000013';
      const res = await request(app.getHttpServer())
        .get(`/api/v1/vehicles/${draftVehicleId}`)
        .expect(404);

      assert.equal(res.body.error.code, 'NOT_FOUND');
    });

    it('10. returns 404 NOT_FOUND for non-existent vehicle UUID', async () => {
      const nonExistentId = '10000000-0000-0000-0000-000000000999';
      const res = await request(app.getHttpServer())
        .get(`/api/v1/vehicles/${nonExistentId}`)
        .expect(404);

      assert.equal(res.body.error.code, 'NOT_FOUND');
    });

    it('11. returns 400 BAD_REQUEST for invalid UUID param', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/vehicles/invalid-uuid-format')
        .expect(400);

      assert.equal(res.body.error.code, 'BAD_REQUEST');
    });
  });
});
