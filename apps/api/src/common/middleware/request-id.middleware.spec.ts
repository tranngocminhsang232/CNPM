import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RequestIdMiddleware } from './request-id.middleware';
import type { Request, Response, NextFunction } from 'express';

describe('RequestIdMiddleware', () => {
  const middleware = new RequestIdMiddleware();

  it('generates a new UUID when x-request-id is not provided', () => {
    const req = { headers: {} } as Request;
    const headersSet: Record<string, string> = {};
    const res = {
      setHeader: (name: string, value: string) => {
        headersSet[name] = value;
      },
    } as unknown as Response;
    let nextCalled = false;
    const next: NextFunction = () => {
      nextCalled = true;
    };

    middleware.use(req, res, next);

    assert.ok(nextCalled);
    assert.ok(req.requestId);
    assert.equal(typeof req.requestId, 'string');
    assert.equal(headersSet['X-Request-Id'], req.requestId);
    assert.equal(req.headers['x-request-id'], req.requestId);
  });

  it('preserves valid client-provided x-request-id', () => {
    const clientId = 'client-trace-12345';
    const req = { headers: { 'x-request-id': clientId } } as unknown as Request;
    const headersSet: Record<string, string> = {};
    const res = {
      setHeader: (name: string, value: string) => {
        headersSet[name] = value;
      },
    } as unknown as Response;
    let nextCalled = false;
    const next: NextFunction = () => {
      nextCalled = true;
    };

    middleware.use(req, res, next);

    assert.ok(nextCalled);
    assert.equal(req.requestId, clientId);
    assert.equal(headersSet['X-Request-Id'], clientId);
  });

  it('replaces invalid client-provided x-request-id with a clean UUID', () => {
    const invalidId = 'bad id with spaces and <script>';
    const req = { headers: { 'x-request-id': invalidId } } as unknown as Request;
    const headersSet: Record<string, string> = {};
    const res = {
      setHeader: (name: string, value: string) => {
        headersSet[name] = value;
      },
    } as unknown as Response;
    let nextCalled = false;
    const next: NextFunction = () => {
      nextCalled = true;
    };

    middleware.use(req, res, next);

    assert.ok(nextCalled);
    assert.notEqual(req.requestId, invalidId);
    assert.ok(headersSet['X-Request-Id']);
  });
});
