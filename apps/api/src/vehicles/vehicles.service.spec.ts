import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VehiclesService } from './vehicles.service';
import { PrismaService } from '../prisma/prisma.service';
import { VehicleSortOption } from './dto/query-vehicles.dto';

describe('VehiclesService (Unit) - G2-01 Search & Filter Engine', () => {
  it('1. getVehicles applies keyword q search across brand and model', async () => {
    let capturedWhere: any = null;
    const mockPrisma = {
      vehicle: {
        count: async ({ where }: any) => {
          capturedWhere = where;
          return 1;
        },
        findMany: async () => [],
      },
    } as unknown as PrismaService;

    const service = new VehiclesService(mockPrisma);
    await service.getVehicles({ q: 'VinFast' });

    assert.ok(capturedWhere);
    assert.equal(capturedWhere.status, 'PUBLISHED');
    assert.deepEqual(capturedWhere.OR, [
      { brand: { contains: 'VinFast', mode: 'insensitive' } },
      { model: { contains: 'VinFast', mode: 'insensitive' } },
    ]);
  });

  it('2. getVehicles applies amenities filter requiring all requested amenities', async () => {
    let capturedWhere: any = null;
    const mockPrisma = {
      vehicle: {
        count: async ({ where }: any) => {
          capturedWhere = where;
          return 1;
        },
        findMany: async () => [],
      },
    } as unknown as PrismaService;

    const service = new VehiclesService(mockPrisma);
    await service.getVehicles({ amenities: ['GPS', 'ETC'] });

    assert.ok(capturedWhere);
    assert.ok(Array.isArray(capturedWhere.AND));
    assert.equal(capturedWhere.AND.length, 2);
    assert.deepEqual(capturedWhere.AND[0], {
      amenities: { some: { amenityCode: 'GPS' } },
    });
    assert.deepEqual(capturedWhere.AND[1], {
      amenities: { some: { amenityCode: 'ETC' } },
    });
  });

  it('3. getVehicles handles popularity and price sorting correctly', async () => {
    let capturedOrderBy: any = null;
    const mockPrisma = {
      vehicle: {
        count: async () => 1,
        findMany: async ({ orderBy }: any) => {
          capturedOrderBy = orderBy;
          return [];
        },
      },
    } as unknown as PrismaService;

    const service = new VehiclesService(mockPrisma);

    await service.getVehicles({ sort: VehicleSortOption.POPULARITY_DESC });
    assert.deepEqual(capturedOrderBy, [{ bookings: { _count: 'desc' } }, { id: 'asc' }]);

    await service.getVehicles({ sort: VehicleSortOption.PRICE_ASC });
    assert.deepEqual(capturedOrderBy, [{ pricePerDayVnd: 'asc' }, { id: 'asc' }]);
  });

  it('4. getVehicles rejects invalid date ranges', async () => {
    const mockPrisma = {} as unknown as PrismaService;
    const service = new VehiclesService(mockPrisma);

    // Missing endAt
    await assert.rejects(
      async () => service.getVehicles({ startAt: '2026-11-01T08:00:00Z' }),
      (err: any) => err.status === 400 && err.response.code === 'VALIDATION_ERROR',
    );

    // endAt before startAt
    await assert.rejects(
      async () =>
        service.getVehicles({
          startAt: '2026-11-05T08:00:00Z',
          endAt: '2026-11-01T08:00:00Z',
        }),
      (err: any) => err.status === 400 && err.response.code === 'VALIDATION_ERROR',
    );
  });

  it('5. getVehicleById rejects non-existent or unpublished vehicle with 404', async () => {
    const mockPrisma = {
      vehicle: {
        findFirst: async () => null,
      },
    } as unknown as PrismaService;

    const service = new VehiclesService(mockPrisma);
    await assert.rejects(
      async () => service.getVehicleById('10000000-0000-0000-0000-000000000999'),
      (err: any) => err.status === 404 && err.response.code === 'NOT_FOUND',
    );
  });

  it('6. getVehicleById returns public details without leaking plate or pickupAddress', async () => {
    const mockVehicle = {
      id: '10000000-0000-0000-0000-000000000001',
      brand: 'VinFast',
      model: 'VF8 Plus',
      year: 2024,
      city: 'TP. Hồ Chí Minh',
      carType: 'SUV',
      transmission: 'AUTO',
      seats: 5,
      description: 'Xe điện mới.',
      pricePerDayVnd: 1400000n,
      plateNormalized: '51K-12345', // Private!
      pickupAddress: '123 Nguyễn Huệ, Q1', // Private!
      keylessSupported: true,
      amenities: [{ amenityCode: 'GPS' }, { amenityCode: 'BLUETOOTH' }],
      photos: [
        {
          media: {
            state: 'VERIFIED',
            finalKey: 'vehicles/vf8.jpg',
          },
        },
      ],
      bookings: [
        {
          status: 'COMPLETED',
          reviews: [{ score: 5 }, { score: 4 }],
        },
      ],
      owner: {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Nguyễn Văn Chủ 1',
        emailNormalized: 'owner1@carsharing.local', // Private!
        phone: '0901111111', // Private!
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
    };

    const mockPrisma = {
      vehicle: {
        findFirst: async () => mockVehicle,
      },
    } as unknown as PrismaService;

    const service = new VehiclesService(mockPrisma);
    const result = await service.getVehicleById('10000000-0000-0000-0000-000000000001');

    assert.equal(result.id, '10000000-0000-0000-0000-000000000001');
    assert.equal(result.brand, 'VinFast');
    assert.equal(result.model, 'VF8 Plus');
    assert.equal(result.ratingAverage, 4.5);
    assert.equal(result.reviewCount, 2);
    assert.equal(result.totalTrips, 1);
    assert.equal(result.photoUrls.length, 1);
    assert.equal(result.owner.name, 'Nguyễn Văn Chủ 1');

    // Strict privacy verification: NO plate, NO pickupAddress, NO owner email/phone
    assert.equal((result as any).plateNormalized, undefined);
    assert.equal((result as any).pickupAddress, undefined);
    assert.equal((result.owner as any).emailNormalized, undefined);
    assert.equal((result.owner as any).phone, undefined);
  });
});
