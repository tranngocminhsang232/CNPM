import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  Controller,
  Get,
  Post,
  Body,
  ConflictException,
  HttpCode,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter, TransformInterceptor } from '../src/common';

class TestDto {
  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;
}

@Controller('test-harness')
class TestHarnessController {
  @Post('validation')
  testValidation(@Body() body: TestDto) {
    return { received: body };
  }

  @Get('business-conflict')
  testConflict() {
    throw new ConflictException('Booking time slot overlaps with an existing reservation');
  }

  @Get('unhandled-crash')
  testCrash() {
    throw new Error('Database password leak simulation: my-super-secret-password');
  }

  @Get('no-content')
  @HttpCode(204)
  testNoContent() {
    return;
  }
}

describe('API Request & Error Contract (e2e)', () => {
  let app: INestApplication;

  before(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestHarnessController],
    }).compile();

    app = moduleFixture.createNestApplication();
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

  it('1. Success: GET /api/v1/health returns { data } and generates X-Request-Id', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    assert.ok(res.headers['x-request-id']);
    assert.ok(res.body.data);
    assert.equal(res.body.data.status, 'ok');
    // Đảm bảo không bị double-wrap { data: { data: ... } }
    assert.equal(res.body.data.data, undefined);
  });

  it('2. RequestId: client header X-Request-Id is echoed in response and error payloads', async () => {
    const customRequestId = 'client-tracing-id-abc-123';
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('X-Request-Id', customRequestId)
      .expect(200);

    assert.equal(res.headers['x-request-id'], customRequestId);
  });

  it('3. Unknown route: 404 returns { error: { code: "NOT_FOUND", message }, requestId }', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/non-existent-route').expect(404);

    assert.ok(res.headers['x-request-id']);
    assert.equal(res.body.data, undefined);
    assert.ok(res.body.error);
    assert.equal(res.body.error.code, 'NOT_FOUND');
    assert.ok(res.body.error.message);
    assert.equal(res.body.requestId, res.headers['x-request-id']);
  });

  it('4. Malformed input: 400 returns { error: { code: "VALIDATION_ERROR", details }, requestId }', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/test-harness/validation')
      .send({ email: 'invalid-email-address' }) // Thiếu name, email sai định dạng
      .expect(400);

    assert.ok(res.body.error);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.equal(res.body.error.message, 'Validation failed');
    assert.ok(Array.isArray(res.body.error.details));
    assert.ok(res.body.error.details.length >= 2);
    assert.equal(res.body.requestId, res.headers['x-request-id']);
  });

  it('5. Business conflict: 409 returns { error: { code: "CONFLICT", message }, requestId }', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/test-harness/business-conflict')
      .expect(409);

    assert.ok(res.body.error);
    assert.equal(res.body.error.code, 'CONFLICT');
    assert.equal(res.body.error.message, 'Booking time slot overlaps with an existing reservation');
    assert.equal(res.body.requestId, res.headers['x-request-id']);
  });

  it('6. Unhandled crash: 500 returns generic message without leaking secret or stack', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/test-harness/unhandled-crash')
      .expect(500);

    assert.ok(res.body.error);
    assert.equal(res.body.error.code, 'INTERNAL_SERVER_ERROR');
    assert.equal(res.body.error.message, 'Internal server error');
    assert.equal(res.body.error.details, undefined);
    assert.equal(res.body.stack, undefined);
    // Xác nhận không lộ từ khóa nhạy cảm
    assert.ok(!JSON.stringify(res.body).includes('my-super-secret-password'));
    assert.equal(res.body.requestId, res.headers['x-request-id']);
  });

  it('7. No Content: 204 does not wrap with JSON envelope', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/test-harness/no-content')
      .expect(204);

    assert.equal(res.text, '');
  });
});
