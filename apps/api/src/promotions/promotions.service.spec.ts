import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { PrismaService } from '../prisma/prisma.service';
import { DiscountType } from '@prisma/client';

describe('PromotionsService (Unit) - G2-03 Promotion & Voucher Engine', () => {
  const basePromo = {
    id: '70000000-0000-0000-0000-000000000001',
    code: 'WELCOME2026',
    description: 'Chào mừng 10%',
    discountType: DiscountType.PERCENTAGE,
    discountValue: 10n,
    maxDiscountVnd: 200000n,
    minOrderValueVnd: 500000n,
    validFrom: new Date('2026-01-01T00:00:00Z'),
    validUntil: new Date('2026-12-31T23:59:59Z'),
    maxUsage: 100,
    usedCount: 5,
    isActive: true,
  };

  it('1. calculates percentage discount correctly below max cap', async () => {
    const mockPrisma = {
      promotion: {
        findUnique: async () => basePromo,
      },
    } as unknown as PrismaService;

    const service = new PromotionsService(mockPrisma);
    const result = await service.validatePromotion('welcome2026', 1500000);

    assert.equal(result.valid, true);
    assert.equal(result.code, 'WELCOME2026');
    assert.equal(result.discountVnd, 150000); // 10% of 1.5M = 150k
    assert.equal(result.subtotalBeforeDiscountVnd, 1500000);
    assert.equal(result.subtotalAfterDiscountVnd, 1350000);
  });

  it('2. caps percentage discount at maxDiscountVnd when order is large', async () => {
    const mockPrisma = {
      promotion: {
        findUnique: async () => basePromo,
      },
    } as unknown as PrismaService;

    const service = new PromotionsService(mockPrisma);
    const result = await service.validatePromotion('WELCOME2026', 3000000);

    // 10% of 3M = 300k, but maxDiscountVnd is 200k
    assert.equal(result.discountVnd, 200000);
    assert.equal(result.subtotalAfterDiscountVnd, 2800000);
  });

  it('3. calculates fixed amount discount correctly', async () => {
    const mockPrisma = {
      promotion: {
        findUnique: async () => ({
          ...basePromo,
          code: 'CARSHARE50K',
          discountType: DiscountType.FIXED_AMOUNT,
          discountValue: 50000n,
          maxDiscountVnd: null,
          minOrderValueVnd: 300000n,
        }),
      },
    } as unknown as PrismaService;

    const service = new PromotionsService(mockPrisma);
    const result = await service.validatePromotion('carshare50k', 600000);

    assert.equal(result.discountVnd, 50000);
    assert.equal(result.subtotalAfterDiscountVnd, 550000);
  });

  it('4. throws NotFoundException (404) for non-existent promotion code', async () => {
    const mockPrisma = {
      promotion: {
        findUnique: async () => null,
      },
    } as unknown as PrismaService;

    const service = new PromotionsService(mockPrisma);
    await assert.rejects(
      async () => service.validatePromotion('INVALID_CODE', 1000000),
      (err: any) =>
        err instanceof NotFoundException && (err.getResponse() as any)?.code === 'NOT_FOUND',
    );
  });

  it('5. throws BadRequestException (400) when promotion is inactive', async () => {
    const mockPrisma = {
      promotion: {
        findUnique: async () => ({
          ...basePromo,
          isActive: false,
        }),
      },
    } as unknown as PrismaService;

    const service = new PromotionsService(mockPrisma);
    await assert.rejects(
      async () => service.validatePromotion('WELCOME2026', 1000000),
      (err: any) =>
        err instanceof BadRequestException &&
        (err.getResponse() as any)?.code === 'INACTIVE_PROMOTION',
    );
  });

  it('6. throws BadRequestException (400) when promotion is expired', async () => {
    const mockPrisma = {
      promotion: {
        findUnique: async () => ({
          ...basePromo,
          validFrom: new Date('2026-01-01T00:00:00Z'),
          validUntil: new Date('2026-03-01T00:00:00Z'), // Expired relative to current date (Oct 2026)
        }),
      },
    } as unknown as PrismaService;

    const service = new PromotionsService(mockPrisma);
    await assert.rejects(
      async () => service.validatePromotion('WELCOME2026', 1000000),
      (err: any) =>
        err instanceof BadRequestException &&
        (err.getResponse() as any)?.code === 'EXPIRED_PROMOTION',
    );
  });

  it('7. throws BadRequestException (400) when promotion usage limit is reached', async () => {
    const mockPrisma = {
      promotion: {
        findUnique: async () => ({
          ...basePromo,
          maxUsage: 10,
          usedCount: 10,
        }),
      },
    } as unknown as PrismaService;

    const service = new PromotionsService(mockPrisma);
    await assert.rejects(
      async () => service.validatePromotion('WELCOME2026', 1000000),
      (err: any) =>
        err instanceof BadRequestException &&
        (err.getResponse() as any)?.code === 'PROMOTION_USAGE_EXCEEDED',
    );
  });

  it('8. throws BadRequestException (400) when subtotal is below minimum order value', async () => {
    const mockPrisma = {
      promotion: {
        findUnique: async () => basePromo, // minOrderValueVnd = 500,000
      },
    } as unknown as PrismaService;

    const service = new PromotionsService(mockPrisma);
    await assert.rejects(
      async () => service.validatePromotion('WELCOME2026', 400000), // 400k < 500k
      (err: any) =>
        err instanceof BadRequestException &&
        (err.getResponse() as any)?.code === 'MINIMUM_ORDER_NOT_MET',
    );
  });

  it('9. prevents discount from exceeding subtotal amount (never negative subtotal)', async () => {
    const mockPrisma = {
      promotion: {
        findUnique: async () => ({
          ...basePromo,
          discountType: DiscountType.FIXED_AMOUNT,
          discountValue: 300000n, // 300k
          minOrderValueVnd: 0n,
        }),
      },
    } as unknown as PrismaService;

    const service = new PromotionsService(mockPrisma);
    const result = await service.validatePromotion('WELCOME2026', 200000); // 200k subtotal

    assert.equal(result.discountVnd, 200000); // Capped at subtotal
    assert.equal(result.subtotalAfterDiscountVnd, 0); // 0, not negative
  });
});
