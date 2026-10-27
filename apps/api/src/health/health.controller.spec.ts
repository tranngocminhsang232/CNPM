import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';
import { ServiceUnavailableException } from '@nestjs/common';

describe('HealthController', () => {
  it('should be defined', () => {
    const mockPrisma = {
      $queryRaw: async () => [{ '?column?': 1 }],
    } as unknown as PrismaService;
    const controller = new HealthController(mockPrisma);
    assert.ok(controller);
  });

  it('should return liveness and readiness status ok when DB is connected', async () => {
    const mockPrisma = {
      $queryRaw: async () => [{ '?column?': 1 }],
    } as unknown as PrismaService;
    const controller = new HealthController(mockPrisma);
    const result = await controller.check();
    assert.equal(result.data.status, 'ok');
    assert.equal(result.data.database, 'connected');
    assert.equal(typeof result.data.timestamp, 'string');
    assert.equal(typeof result.data.uptime, 'number');
    assert.ok(result.data.uptime >= 0);
  });

  it('should throw ServiceUnavailableException when DB is disconnected', async () => {
    const mockPrisma = {
      $queryRaw: async () => {
        throw new Error('Connection refused');
      },
    } as unknown as PrismaService;
    const controller = new HealthController(mockPrisma);

    await assert.rejects(
      async () => {
        await controller.check();
      },
      (err: unknown) => {
        assert.ok(err instanceof ServiceUnavailableException);
        assert.equal(err.getStatus(), 503);
        return true;
      },
    );
  });
});
