import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HttpExceptionFilter } from './http-exception.filter';
import { BadRequestException, NotFoundException, ArgumentsHost, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  function createMockHost(req: Partial<Request>, res: Partial<Response>): ArgumentsHost {
    return {
      switchToHttp: () => ({
        getRequest: () => req as Request,
        getResponse: () => res as Response,
      }),
    } as unknown as ArgumentsHost;
  }

  it('formats standard HttpException into { error: { code, message }, requestId }', () => {
    let capturedStatus: number | undefined;
    let capturedBody: unknown;

    const res: Partial<Response> = {
      status: (status: number) => {
        capturedStatus = status;
        return res as Response;
      },
      json: (body: unknown) => {
        capturedBody = body;
        return res as Response;
      },
    };

    const req: Partial<Request> = {
      requestId: 'req-test-123',
      headers: {},
      url: '/test',
      method: 'GET',
    };

    const host = createMockHost(req, res);
    const exception = new NotFoundException('Vehicle not found');

    filter.catch(exception, host);

    assert.equal(capturedStatus, HttpStatus.NOT_FOUND);
    assert.deepEqual(capturedBody, {
      error: {
        code: 'NOT_FOUND',
        message: 'Vehicle not found',
      },
      requestId: 'req-test-123',
    });
  });

  it('formats validation errors into VALIDATION_ERROR with details', () => {
    let capturedStatus: number | undefined;
    let capturedBody: unknown;

    const res: Partial<Response> = {
      status: (status: number) => {
        capturedStatus = status;
        return res as Response;
      },
      json: (body: unknown) => {
        capturedBody = body;
        return res as Response;
      },
    };

    const req: Partial<Request> = {
      requestId: 'req-val-456',
      headers: {},
      url: '/test',
      method: 'POST',
    };

    const host = createMockHost(req, res);
    const validationErrors = ['startAt must be a valid ISO date', 'endAt must be after startAt'];
    const exception = new BadRequestException({
      statusCode: 400,
      message: validationErrors,
    });

    filter.catch(exception, host);

    assert.equal(capturedStatus, HttpStatus.BAD_REQUEST);
    assert.deepEqual(capturedBody, {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: validationErrors,
      },
      requestId: 'req-val-456',
    });
  });

  it('masks unexpected 500 errors without leaking stack traces or secrets', () => {
    let capturedStatus: number | undefined;
    let capturedBody: unknown;

    const res: Partial<Response> = {
      status: (status: number) => {
        capturedStatus = status;
        return res as Response;
      },
      json: (body: unknown) => {
        capturedBody = body;
        return res as Response;
      },
    };

    const req: Partial<Request> = {
      requestId: 'req-err-789',
      headers: {},
      url: '/crash',
      method: 'GET',
    };

    const host = createMockHost(req, res);
    const secretDbError = new Error(
      'FATAL: password authentication failed for user "carsharing_secret"',
    );

    filter.catch(secretDbError, host);

    assert.equal(capturedStatus, HttpStatus.INTERNAL_SERVER_ERROR);
    assert.deepEqual(capturedBody, {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
      },
      requestId: 'req-err-789',
    });
  });
});
