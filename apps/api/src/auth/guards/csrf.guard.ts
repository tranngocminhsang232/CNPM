import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_CSRF_KEY } from '../decorators/public-csrf.decorator';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method.toUpperCase();

    // Các phương thức an toàn không làm thay đổi trạng thái (GET, HEAD, OPTIONS)
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return true;
    }

    // Kiểm tra Double Submit CSRF Token
    const headerToken = request.headers['x-csrf-token'];
    const cookieToken = request.cookies?.csrf_token;

    if (!headerToken || !cookieToken || headerToken !== cookieToken) {
      throw new ForbiddenException({
        message: 'Mã xác thực CSRF không hợp lệ hoặc bị thiếu',
        code: 'CSRF_INVALID',
      });
    }

    return true;
  }
}
