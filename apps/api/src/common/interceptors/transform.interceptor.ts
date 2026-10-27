import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Response } from 'express';

export interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T> | T | void> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T> | T | void> {
    const http = context.switchToHttp();
    const response = http.getResponse<Response>();

    return next.handle().pipe(
      map((data) => {
        // Không bọc response nếu status code là 204 No Content
        if (response.statusCode === 204) {
          return data;
        }

        // Không bọc nếu response đã hoàn tất hoặc là redirect
        if (response.headersSent || (response.statusCode >= 300 && response.statusCode < 400)) {
          return data;
        }

        // Không double-wrap response nếu dữ liệu đã có cấu trúc { data, meta? }
        if (data !== null && typeof data === 'object' && 'data' in data) {
          return data as ApiResponse<T>;
        }

        // Bọc dữ liệu thông thường vào cấu trúc { data }
        return {
          data,
        };
      }),
    );
  }
}
