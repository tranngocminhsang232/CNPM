import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth.service';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();

    // 1. Trích xuất token từ cookie HttpOnly (mặc định) hoặc Authorization header (API tests)
    let token: string | undefined;

    if (request.cookies && typeof request.cookies.access_token === 'string') {
      token = request.cookies.access_token;
    } else if (request.headers.authorization?.startsWith('Bearer ')) {
      token = request.headers.authorization.substring(7).trim();
    }

    if (!token) {
      throw new UnauthorizedException({
        message: 'Yêu cầu đăng nhập để thực hiện hành động này',
        code: 'UNAUTHORIZED',
      });
    }

    // 2. Xác thực token và nạp user
    const user = await this.authService.validateAccessToken(token);
    if (!user) {
      throw new UnauthorizedException({
        message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn',
        code: 'INVALID_SESSION',
      });
    }

    // 3. Gắn user vào request context
    request.user = user;
    return true;
  }
}
