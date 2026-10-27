import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

// Giới hạn độ dài và ký tự an toàn cho request ID nhận từ client
const REQUEST_ID_REGEX = /^[a-zA-Z0-9_-]{1,100}$/;

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incomingId = req.headers['x-request-id'];
    let requestId: string;

    if (typeof incomingId === 'string' && REQUEST_ID_REGEX.test(incomingId)) {
      requestId = incomingId;
    } else {
      requestId = randomUUID();
    }

    req.requestId = requestId;
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-Id', requestId);

    next();
  }
}
