import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NestFactory } from '@nestjs/core';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter, TransformInterceptor } from '../src/common';

describe('Pricing API (e2e) - G2-02 Pricing Engine & Quote Calculation', () => {
  let app: INestApplication;
  const publishedVehicleId = '10000000-0000-0000-0000-000000000001';

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

  it('1. POST /api/v1/pricing/quote returns 200 with accurate calculation & total integrity', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/pricing/quote')
      .send({
        vehicleId: publishedVehicleId,
        startAt: '2026-11-09T08:00:00.000Z', // Monday
        endAt: '2026-11-11T08:00:00.000Z', // Wednesday (48h: 2 days)
        insurancePackage: 'STANDARD',
      })
      .expect(200);

    const quote = res.body.data;
    assert.equal(quote.vehicleId, publishedVehicleId);
    assert.equal(quote.rentalDays, 2);
    assert.equal(quote.pricePerDayVnd, 1400000); // VinFast VF8 Plus is 1.400.000
    assert.equal(quote.breakdown.baseRentVnd, 2800000); // 1.4M * 2
    assert.equal(quote.breakdown.insuranceFeeVnd, 200000); // 100k * 2 (STANDARD)
    assert.ok(quote.breakdown.depositVnd > 0);
    assert.ok(quote.breakdown.serviceFeeVnd > 0);

    // Strict check constraint equality
    assert.equal(quote.totalVnd, quote.subtotalVnd + quote.serviceFeeVnd + quote.depositVnd);
    assert.equal(quote.pricingVersion, 'daily-v1');
    assert.equal(quote.available, true);
  });

  it('2. POST /api/v1/pricing/calculate alias returns 200', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/pricing/calculate')
      .send({
        vehicleId: publishedVehicleId,
        startAt: '2026-11-09T08:00:00.000Z',
        endAt: '2026-11-10T08:00:00.000Z',
      })
      .expect(200);

    assert.equal(res.body.data.rentalDays, 1);
    assert.equal(res.body.data.vehicleId, publishedVehicleId);
  });

  it('3. GET /api/v1/vehicles/:id/pricing-preview returns 200 for frontend calculator widget', async () => {
    const res = await request(app.getHttpServer())
      .get(
        `/api/v1/vehicles/${publishedVehicleId}/pricing-preview?startAt=2026-11-09T08:00:00.000Z&endAt=2026-11-10T08:00:00.000Z&insurancePackage=PREMIUM`,
      )
      .expect(200);

    const quote = res.body.data;
    assert.equal(quote.vehicleId, publishedVehicleId);
    assert.equal(quote.breakdown.insuranceFeeVnd, 200000); // PREMIUM 200k/day
    assert.equal(quote.totalVnd, quote.subtotalVnd + quote.serviceFeeVnd + quote.depositVnd);
  });

  it('4. POST /api/v1/pricing/quote rejects duration < 1 hour with 422 INVALID_RENTAL_PERIOD', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/pricing/quote')
      .send({
        vehicleId: publishedVehicleId,
        startAt: '2026-11-09T08:00:00.000Z',
        endAt: '2026-11-09T08:30:00.000Z',
      })
      .expect(422);

    assert.equal(res.body.error.code, 'INVALID_RENTAL_PERIOD');
  });

  it('5. POST /api/v1/pricing/quote rejects endAt <= startAt with 400 VALIDATION_ERROR', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/pricing/quote')
      .send({
        vehicleId: publishedVehicleId,
        startAt: '2026-11-09T18:00:00.000Z',
        endAt: '2026-11-09T08:00:00.000Z',
      })
      .expect(400);

    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  it('6. POST /api/v1/pricing/quote returns available: false when vehicle has calendar conflict', async () => {
    // Vehicle 3 has an APPROVED booking in [now + 2 days, now + 4 days]
    const vehicle3Id = '10000000-0000-0000-0000-000000000003';
    const now = new Date();
    const dayMs = 24 * 3600 * 1000;
    const startAt = new Date(now.getTime() + 2.5 * dayMs).toISOString();
    const endAt = new Date(now.getTime() + 3.5 * dayMs).toISOString();

    const res = await request(app.getHttpServer())
      .post('/api/v1/pricing/quote')
      .send({
        vehicleId: vehicle3Id,
        startAt,
        endAt,
      })
      .expect(200);

    assert.equal(res.body.data.available, false);
    assert.ok(res.body.data.unavailableReason);
  });

  it('7. POST /api/v1/pricing/quote rejects non-existent vehicle with 404 NOT_FOUND', async () => {
    const nonExistentVehicleId = '10000000-0000-0000-0000-000000000999';
    const res = await request(app.getHttpServer())
      .post('/api/v1/pricing/quote')
      .send({
        vehicleId: nonExistentVehicleId,
        startAt: '2026-11-09T08:00:00.000Z',
        endAt: '2026-11-10T08:00:00.000Z',
      })
      .expect(404);

    assert.equal(res.body.error.code, 'NOT_FOUND');
  });
});
