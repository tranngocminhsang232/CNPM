import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { PrismaService } from '../prisma/prisma.service';

describe('VehiclesController', () => {
  const mockPrisma = {} as unknown as PrismaService;
  const service = new VehiclesService(mockPrisma);
  const controller = new VehiclesController(service);

  it('getVehicleOptions returns available options with data wrapper', () => {
    const result = controller.getVehicleOptions();
    assert.ok(result.data);
    assert.ok(Array.isArray(result.data.cities));
    assert.ok(result.data.cities.includes('TP. Hồ Chí Minh'));
    assert.ok(result.data.cities.includes('Hà Nội'));
    assert.ok(result.data.carTypes.includes('SUV'));
    assert.ok(result.data.transmissions.includes('AUTO'));
    assert.ok(result.data.amenities.some((a) => a.code === 'GPS'));
  });
});
