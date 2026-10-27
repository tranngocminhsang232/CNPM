import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NestFactory } from '@nestjs/core';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter, TransformInterceptor } from '../src/common';

describe('Promotions API (e2e) - G2-03 Promotion & Voucher Engine', () => {
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

  it('1. POST /api/v1/promotions/validate returns 200 with 10% discount for WELCOME2026', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/promotions/validate')
      .send({
        code: 'welcome2026',
        subtotalVnd: 1500000,
      })
      .expect(200);

    const promo = res.body.data;
    assert.equal(promo.code, 'WELCOME2026');
    assert.equal(promo.discountType, 'PERCENTAGE');
    assert.equal(promo.discountValue, 10);
    assert.equal(promo.discountVnd, 150000); // 10% of 1.5M
    assert.equal(promo.subtotalBeforeDiscountVnd, 1500000);
    assert.equal(promo.subtotalAfterDiscountVnd, 1350000);
    assert.equal(promo.valid, true);
  });

  it('2. POST /api/v1/promotions/validate caps percentage discount at maxDiscountVnd (200k)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/promotions/validate')
      .send({
        code: 'WELCOME2026',
        subtotalVnd: 3000000,
      })
      .expect(200);

    const promo = res.body.data;
    assert.equal(promo.discountVnd, 200000); // Capped at 200,000 VND
    assert.equal(promo.subtotalAfterDiscountVnd, 2800000);
    assert.equal(promo.valid, true);
  });

  it('3. POST /api/v1/promotions/validate applies fixed amount discount for CARSHARE50K', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/promotions/validate')
      .send({
        code: 'carshare50k',
        subtotalVnd: 600000,
      })
      .expect(200);

    const promo = res.body.data;
    assert.equal(promo.code, 'CARSHARE50K');
    assert.equal(promo.discountType, 'FIXED_AMOUNT');
    assert.equal(promo.discountVnd, 50000);
    assert.equal(promo.subtotalAfterDiscountVnd, 550000);
    assert.equal(promo.valid, true);
  });

  it('4. POST /api/v1/promotions/validate returns 404 for non-existent promotion code', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/promotions/validate')
      .send({
        code: 'NON_EXISTENT_CODE_XYZ',
        subtotalVnd: 1000000,
      })
      .expect(404);

    assert.equal(res.body.error.code, 'NOT_FOUND');
  });

  it('5. POST /api/v1/promotions/validate returns 400 for inactive promotion', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/promotions/validate')
      .send({
        code: 'INACTIVE',
        subtotalVnd: 1000000,
      })
      .expect(400);

    assert.equal(res.body.error.code, 'INACTIVE_PROMOTION');
  });

  it('6. POST /api/v1/promotions/validate returns 400 for expired promotion', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/promotions/validate')
      .send({
        code: 'VIPSUMMER',
        subtotalVnd: 2500000,
      })
      .expect(400);

    assert.equal(res.body.error.code, 'EXPIRED_PROMOTION');
  });

  it('7. POST /api/v1/promotions/validate returns 400 when promotion usage limit is reached', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/promotions/validate')
      .send({
        code: 'SOLDOUT',
        subtotalVnd: 1000000,
      })
      .expect(400);

    assert.equal(res.body.error.code, 'PROMOTION_USAGE_EXCEEDED');
  });

  it('8. POST /api/v1/promotions/validate returns 400 when subtotal does not meet minimum order', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/promotions/validate')
      .send({
        code: 'WELCOME2026',
        subtotalVnd: 400000, // < 500,000 VND
      })
      .expect(400);

    assert.equal(res.body.error.code, 'MINIMUM_ORDER_NOT_MET');
  });

  it('9. POST /api/v1/pricing/quote calculates pricing correctly with valid voucher code', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/pricing/quote')
      .send({
        vehicleId: publishedVehicleId,
        startAt: '2026-11-09T08:00:00.000Z', // Monday
        endAt: '2026-11-11T08:00:00.000Z', // Wednesday (2 days)
        insurancePackage: 'BASIC',
        voucherCode: 'WELCOME2026',
      })
      .expect(200);

    const quote = res.body.data;
    assert.equal(quote.rentalDays, 2);
    assert.equal(quote.pricePerDayVnd, 1400000);
    assert.equal(quote.breakdown.baseRentVnd, 2800000);
    assert.equal(quote.breakdown.discountVnd, 200000); // 10% of 2.8M capped at 200k
    assert.equal(quote.breakdown.subtotalVnd, 2600000); // 2.8M - 200k = 2.6M
    assert.equal(quote.breakdown.serviceFeeVnd, 280000); // 10% of 2.8M baseRent
    assert.equal(quote.breakdown.depositVnd, 10000000); // 10M for pricePerDay 1.4M
    assert.equal(quote.breakdown.totalVnd, 12880000); // 2.6M + 280k + 10M = 12.88M
    assert.equal(quote.totalVnd, quote.subtotalVnd + quote.serviceFeeVnd + quote.depositVnd);
  });

  it('10. POST /api/v1/pricing/quote rejects non-existent voucher code with 404', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/pricing/quote')
      .send({
        vehicleId: publishedVehicleId,
        startAt: '2026-11-09T08:00:00.000Z',
        endAt: '2026-11-11T08:00:00.000Z',
        voucherCode: 'FAKE_VOUCHER_CODE',
      })
      .expect(404);

    assert.equal(res.body.error.code, 'NOT_FOUND');
  });
});
