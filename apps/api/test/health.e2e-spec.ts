import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NestFactory } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Health API (smoke e2e)', () => {
  let app: INestApplication;

  before(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  after(async () => {
    await app.close();
  });

  it('GET /api/v1/health returns 200 with liveness status ok', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    assert.equal(response.body.data.status, 'ok');
    assert.equal(typeof response.body.data.timestamp, 'string');
    assert.equal(typeof response.body.data.uptime, 'number');
  });
});
