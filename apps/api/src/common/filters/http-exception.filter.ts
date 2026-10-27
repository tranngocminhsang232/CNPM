import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  error: ApiErrorPayload;
  requestId: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId =
      request.requestId ||
      (typeof request.headers['x-request-id'] === 'string'
        ? request.headers['x-request-id']
        : randomUUID());

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'Internal server error';
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resObj = exceptionResponse as Record<string, unknown>;

        // Trường hợp ValidationPipe trả về mảng message lỗi
        if (Array.isArray(resObj.message)) {
          code = 'VALIDATION_ERROR';
          message = 'Validation failed';
          details = resObj.message;
        } else {
          code =
            (typeof resObj.code === 'string' && resObj.code) ||
            this.getDefaultCodeForStatus(status);
          message = (typeof resObj.message === 'string' && resObj.message) || exception.message;
          details = resObj.details;
        }
      } else if (typeof exceptionResponse === 'string') {
        code = this.getDefaultCodeForStatus(status);
        message = exceptionResponse;
      }
    } else {
      // Lỗi không mong đợi (500) - Log trên server có lọc thông tin nhạy cảm
      const sanitizedUrl = request.url;
      const sanitizedMethod = request.method;
      const errMessage = exception instanceof Error ? exception.message : String(exception);
      const errStack = exception instanceof Error ? exception.stack : undefined;

      this.logger.error(
        `[${requestId}] ${sanitizedMethod} ${sanitizedUrl} - Unhandled Exception: ${errMessage}`,
        errStack,
      );
    }

    const errorBody: ApiErrorResponse = {
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
      requestId,
    };

    response.status(status).json(errorBody);
  }

  private getDefaultCodeForStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.PAYLOAD_TOO_LARGE:
        return 'PAYLOAD_TOO_LARGE';
      case HttpStatus.UNSUPPORTED_MEDIA_TYPE:
        return 'UNSUPPORTED_MEDIA_TYPE';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'UNPROCESSABLE_ENTITY';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'TOO_MANY_REQUESTS';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'SERVICE_UNAVAILABLE';
      default:
        return 'INTERNAL_SERVER_ERROR';
    }
  }
}
