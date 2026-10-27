import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CarType, Transmission, VehicleStatus } from '@prisma/client';
import { OwnerVehiclesService } from './owner-vehicles.service';
import { CreateVehicleDto, normalizePlate } from './dto/owner-vehicle.dto';

describe('OwnerVehiclesService (Unit) - G1-04', () => {
  it('1. normalizePlate correctly standardizes various Vietnamese plate formats', () => {
    assert.equal(normalizePlate('51K-123.45'), '51K-12345');
    assert.equal(normalizePlate('30A 99999'), '30A-99999');
    assert.equal(normalizePlate('51k10001'), '51K-10001');
    assert.equal(normalizePlate('43A-100.12'), '43A-10012');
  });

  it('2. createVehicle rejects duplicate license plate with 409 CONFLICT', async () => {
    const fakePrisma = {
      vehicle: {
        findUnique: async () => ({ id: 'existing-id', plateNormalized: '51K-10001' }),
      },
    } as any;

    const service = new OwnerVehiclesService(fakePrisma);
    const dto: CreateVehicleDto = {
      brand: 'Toyota',
      model: 'Vios',
      year: 2022,
      licensePlate: '51K-100.01',
      city: 'TP. Hồ Chí Minh',
      pickupAddress: '123 Đường Số 1',
      carType: CarType.SEDAN,
      transmission: Transmission.AUTO,
      seats: 5,
      description: 'Xe mới tiết kiệm nhiên liệu.',
      pricePerDayVnd: 800000,
    };

    await assert.rejects(
      async () => service.createVehicle('owner-1', dto),
      (err: any) =>
        err instanceof ConflictException && (err.getResponse() as any).code === 'CONFLICT',
    );
  });

  it('3. createVehicle rejects if photoMediaIds are not verified (400 VALIDATION_ERROR)', async () => {
    const fakePrisma = {
      vehicle: {
        findUnique: async () => null,
      },
      mediaObject: {
        findMany: async () => [], // None verified
      },
    } as any;

    const service = new OwnerVehiclesService(fakePrisma);
    const dto: CreateVehicleDto = {
      brand: 'Toyota',
      model: 'Vios',
      year: 2022,
      licensePlate: '51K-99999',
      city: 'TP. Hồ Chí Minh',
      pickupAddress: '123 Đường Số 1',
      carType: CarType.SEDAN,
      transmission: Transmission.AUTO,
      seats: 5,
      description: 'Xe mới tiết kiệm nhiên liệu.',
      pricePerDayVnd: 800000,
      photoMediaIds: ['50000000-0000-0000-0000-000000000001'],
    };

    await assert.rejects(
      async () => service.createVehicle('owner-1', dto),
      (err: any) =>
        err instanceof BadRequestException &&
        (err.getResponse() as any).code === 'VALIDATION_ERROR',
    );
  });

  it('4. getOwnerVehicleById rejects non-existent vehicle (404 NOT_FOUND)', async () => {
    const fakePrisma = {
      vehicle: {
        findUnique: async () => null,
      },
    } as any;

    const service = new OwnerVehiclesService(fakePrisma);

    await assert.rejects(
      async () => service.getOwnerVehicleById('non-existent-id', 'owner-1'),
      (err: any) => err instanceof NotFoundException,
    );
  });

  it('5. getOwnerVehicleById rejects if requesting user is not owner (403 FORBIDDEN)', async () => {
    const fakePrisma = {
      vehicle: {
        findUnique: async () => ({
          id: 'v-1',
          ownerId: 'owner-real',
        }),
      },
    } as any;

    const service = new OwnerVehiclesService(fakePrisma);

    await assert.rejects(
      async () => service.getOwnerVehicleById('v-1', 'attacker-owner'),
      (err: any) => err instanceof ForbiddenException,
    );
  });

  it('6. publishVehicle rejects if vehicle has 0 photos (422 UNPROCESSABLE_ENTITY)', async () => {
    const fakePrisma = {
      vehicle: {
        findUnique: async () => ({
          id: 'v-1',
          ownerId: 'owner-1',
          status: VehicleStatus.DRAFT,
          photos: [], // 0 photos
        }),
      },
    } as any;

    const service = new OwnerVehiclesService(fakePrisma);

    await assert.rejects(
      async () => service.publishVehicle('v-1', 'owner-1'),
      (err: any) =>
        err instanceof UnprocessableEntityException &&
        (err.getResponse() as any).code === 'PUBLISH_REQUIREMENTS_NOT_MET',
    );
  });

  it('7. publishVehicle updates status to PUBLISHED when vehicle has photos', async () => {
    let updatedStatus: any = null;
    const fakePrisma = {
      vehicle: {
        findUnique: async () => ({
          id: 'v-1',
          ownerId: 'owner-1',
          status: VehicleStatus.DRAFT,
          photos: [{ mediaId: 'm-1', position: 0 }],
        }),
        update: async ({ data }: any) => {
          updatedStatus = data.status;
          return {
            id: 'v-1',
            ownerId: 'owner-1',
            brand: 'Toyota',
            model: 'Vios',
            year: 2022,
            plateNormalized: '51K-10001',
            city: 'TP. Hồ Chí Minh',
            pickupAddress: '123 Đường Số 1',
            carType: CarType.SEDAN,
            transmission: Transmission.AUTO,
            seats: 5,
            description: 'Xe gia đình.',
            pricePerDayVnd: BigInt(800000),
            keylessSupported: false,
            status: data.status,
            version: 2,
            createdAt: new Date(),
            updatedAt: new Date(),
            amenities: [],
            photos: [{ mediaId: 'm-1', position: 0 }],
          };
        },
      },
    } as any;

    const service = new OwnerVehiclesService(fakePrisma);
    const result = await service.publishVehicle('v-1', 'owner-1');

    assert.equal(updatedStatus, VehicleStatus.PUBLISHED);
    assert.equal(result.status, VehicleStatus.PUBLISHED);
    assert.equal(result.version, 2);
  });
});
