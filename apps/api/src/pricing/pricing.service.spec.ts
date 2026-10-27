import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PricingService } from './pricing.service';
import { PrismaService } from '../prisma/prisma.service';
import { PromotionsService } from '../promotions/promotions.service';
import { InsurancePackageTier } from './dto/calculate-pricing.dto';

describe('PricingService (Unit) - G2-02 & G2-03 Pricing & Voucher Engine', () => {
  const mockVehicle = {
    id: '10000000-0000-0000-0000-000000000001',
    pricePerDayVnd: 1000000n, // 1.000.000 VND / day
    status: 'PUBLISHED',
  };

  const defaultMockPromotions = {
    validatePromotion: async (code: string, subtotalVnd: number) => {
      if (code.toUpperCase() === 'WELCOME2026') {
        const discount = Math.min(Math.round(subtotalVnd * 0.1), 200000);
        return {
          code: 'WELCOME2026',
          discountVnd: discount,
          subtotalBeforeDiscountVnd: subtotalVnd,
          subtotalAfterDiscountVnd: subtotalVnd - discount,
          valid: true,
        };
      }
      throw new Error('Not found');
    },
  } as unknown as PromotionsService;

  it('1. calculates standard quote for 1 day weekday with BASIC insurance', async () => {
    const mockPrisma = {
      vehicle: {
        findUnique: async () => mockVehicle,
      },
      vehicleCalendar: {
        findFirst: async () => null, // No conflict
      },
    } as unknown as PrismaService;

    const service = new PricingService(mockPrisma, defaultMockPromotions);

    // Monday to Tuesday (24h)
    const quote = await service.calculateQuote({
      vehicleId: mockVehicle.id,
      startAt: '2026-11-02T08:00:00.000Z', // Monday
      endAt: '2026-11-03T08:00:00.000Z', // Tuesday
      insurancePackage: InsurancePackageTier.BASIC,
    });

    assert.equal(quote.vehicleId, mockVehicle.id);
    assert.equal(quote.rentalDays, 1);
    assert.equal(quote.pricePerDayVnd, 1000000);
    assert.equal(quote.breakdown.baseRentVnd, 1000000);
    assert.equal(quote.breakdown.peakSurchargeVnd, 0); // No weekend
    assert.equal(quote.breakdown.insuranceFeeVnd, 0); // BASIC
    assert.equal(quote.breakdown.subtotalVnd, 1000000);
    assert.equal(quote.breakdown.serviceFeeVnd, 100000); // 10% of 1M
    assert.equal(quote.breakdown.depositVnd, 5000000); // 5M for <= 1M/day
    assert.equal(quote.breakdown.totalVnd, 6100000); // 1M + 100k + 5M = 6.1M
    assert.equal(quote.totalVnd, quote.subtotalVnd + quote.serviceFeeVnd + quote.depositVnd);
    assert.equal(quote.available, true);
  });

  it('2. adds weekend peak surcharge (10%) when rental spans Saturday or Sunday', async () => {
    const mockPrisma = {
      vehicle: {
        findUnique: async () => mockVehicle,
      },
      vehicleCalendar: {
        findFirst: async () => null,
      },
    } as unknown as PrismaService;

    const service = new PricingService(mockPrisma, defaultMockPromotions);

    // Friday 08:00 to Sunday 08:00 (48h: 2 days, includes Saturday)
    const quote = await service.calculateQuote({
      vehicleId: mockVehicle.id,
      startAt: '2026-11-06T08:00:00.000Z', // Friday
      endAt: '2026-11-08T08:00:00.000Z', // Sunday
      insurancePackage: InsurancePackageTier.BASIC,
    });

    assert.equal(quote.rentalDays, 2);
    assert.equal(quote.breakdown.baseRentVnd, 2000000);
    // Spans Friday and Saturday (1 weekend day: Saturday)
    assert.ok(quote.breakdown.peakSurchargeVnd > 0);
    assert.equal(quote.totalVnd, quote.subtotalVnd + quote.serviceFeeVnd + quote.depositVnd);
  });

  it('3. applies PREMIUM insurance package fee per day', async () => {
    const mockPrisma = {
      vehicle: {
        findUnique: async () => mockVehicle,
      },
      vehicleCalendar: {
        findFirst: async () => null,
      },
    } as unknown as PrismaService;

    const service = new PricingService(mockPrisma, defaultMockPromotions);

    // 2 days Monday to Wednesday
    const quote = await service.calculateQuote({
      vehicleId: mockVehicle.id,
      startAt: '2026-11-02T08:00:00.000Z',
      endAt: '2026-11-04T08:00:00.000Z',
      insurancePackage: InsurancePackageTier.PREMIUM,
    });

    assert.equal(quote.rentalDays, 2);
    assert.equal(quote.breakdown.insuranceFeeVnd, 400000); // 200k * 2
    assert.equal(quote.breakdown.subtotalVnd, 2400000); // 2M base + 400k insurance
    assert.equal(quote.totalVnd, quote.subtotalVnd + quote.serviceFeeVnd + quote.depositVnd);
  });

  it('4. detects calendar conflict and marks available = false', async () => {
    const mockConflict = {
      id: 'conflict-id',
      kind: 'BOOKING',
      startAt: new Date('2026-11-02T08:00:00.000Z'),
      endAt: new Date('2026-11-04T08:00:00.000Z'),
    };

    const mockPrisma = {
      vehicle: {
        findUnique: async () => mockVehicle,
      },
      vehicleCalendar: {
        findFirst: async () => mockConflict,
      },
    } as unknown as PrismaService;

    const service = new PricingService(mockPrisma, defaultMockPromotions);

    const quote = await service.calculateQuote({
      vehicleId: mockVehicle.id,
      startAt: '2026-11-02T08:00:00.000Z',
      endAt: '2026-11-03T08:00:00.000Z',
    });

    assert.equal(quote.available, false);
    assert.ok(quote.unavailableReason);
  });

  it('5. rejects invalid date order (endAt <= startAt) with 400 VALIDATION_ERROR', async () => {
    const mockPrisma = {} as unknown as PrismaService;
    const service = new PricingService(mockPrisma, defaultMockPromotions);

    await assert.rejects(
      async () =>
        service.calculateQuote({
          vehicleId: mockVehicle.id,
          startAt: '2026-11-05T08:00:00.000Z',
          endAt: '2026-11-02T08:00:00.000Z',
        }),
      (err: any) => err.status === 400 && err.response.code === 'VALIDATION_ERROR',
    );
  });

  it('6. rejects rental duration under 1 hour with 422 INVALID_RENTAL_PERIOD', async () => {
    const mockPrisma = {} as unknown as PrismaService;
    const service = new PricingService(mockPrisma, defaultMockPromotions);

    await assert.rejects(
      async () =>
        service.calculateQuote({
          vehicleId: mockVehicle.id,
          startAt: '2026-11-02T08:00:00.000Z',
          endAt: '2026-11-02T08:30:00.000Z', // 30 minutes
        }),
      (err: any) => err.status === 422 && err.response.code === 'INVALID_RENTAL_PERIOD',
    );
  });

  it('7. rejects non-existent vehicle with 404 NOT_FOUND', async () => {
    const mockPrisma = {
      vehicle: {
        findUnique: async () => null,
      },
    } as unknown as PrismaService;

    const service = new PricingService(mockPrisma, defaultMockPromotions);

    await assert.rejects(
      async () =>
        service.calculateQuote({
          vehicleId: 'non-existent-vehicle',
          startAt: '2026-11-02T08:00:00.000Z',
          endAt: '2026-11-03T08:00:00.000Z',
        }),
      (err: any) => err.status === 404 && err.response.code === 'NOT_FOUND',
    );
  });

  it('8. applies voucher discount and recalculates subtotal and total accurately', async () => {
    const mockPrisma = {
      vehicle: {
        findUnique: async () => mockVehicle,
      },
      vehicleCalendar: {
        findFirst: async () => null,
      },
    } as unknown as PrismaService;

    const service = new PricingService(mockPrisma, defaultMockPromotions);

    const quote = await service.calculateQuote({
      vehicleId: mockVehicle.id,
      startAt: '2026-11-02T08:00:00.000Z',
      endAt: '2026-11-04T08:00:00.000Z', // 2 days = 2M base
      insurancePackage: InsurancePackageTier.BASIC,
      voucherCode: 'WELCOME2026', // 10% capped at 200k -> 200k discount
    });

    assert.equal(quote.rentalDays, 2);
    assert.equal(quote.breakdown.baseRentVnd, 2000000);
    assert.equal(quote.breakdown.discountVnd, 200000);
    assert.equal(quote.breakdown.subtotalVnd, 1800000); // 2M - 200k = 1.8M
    assert.equal(quote.breakdown.serviceFeeVnd, 200000); // 10% of 2M
    assert.equal(quote.breakdown.depositVnd, 5000000);
    assert.equal(quote.breakdown.totalVnd, 7000000); // 1.8M + 200k + 5M = 7M
    assert.equal(quote.totalVnd, quote.subtotalVnd + quote.serviceFeeVnd + quote.depositVnd);
  });
});
