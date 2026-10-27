import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { of, firstValueFrom } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import type { Response } from 'express';

describe('TransformInterceptor', () => {
  const interceptor = new TransformInterceptor();

  function createMockContext(statusCode = 200, headersSent = false): ExecutionContext {
    const mockResponse = {
      statusCode,
      headersSent,
    } as Response;

    return {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;
  }

  it('wraps raw primitive/object data into { data }', async () => {
    const context = createMockContext(200);
    const handler: CallHandler = {
      handle: () => of({ name: 'Car Sharing' }),
    };

    const result = await firstValueFrom(interceptor.intercept(context, handler));
    assert.deepEqual(result, {
      data: { name: 'Car Sharing' },
    });
  });

  it('does not double wrap if response already has { data } structure', async () => {
    const context = createMockContext(200);
    const handler: CallHandler = {
      handle: () => of({ data: { status: 'ok' }, meta: { total: 1 } }),
    };

    const result = await firstValueFrom(interceptor.intercept(context, handler));
    assert.deepEqual(result, {
      data: { status: 'ok' },
      meta: { total: 1 },
    });
  });

  it('does not wrap 204 No Content responses', async () => {
    const context = createMockContext(204);
    const handler: CallHandler = {
      handle: () => of(undefined),
    };

    const result = await firstValueFrom(interceptor.intercept(context, handler));
    assert.equal(result, undefined);
  });
});
