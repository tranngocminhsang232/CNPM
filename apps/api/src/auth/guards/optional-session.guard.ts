import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth.service';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

@Injectable()
export class OptionalSessionGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();

    let token: string | undefined;

    if (request.cookies && typeof request.cookies.access_token === 'string') {
      token = request.cookies.access_token;
    } else if (request.headers.authorization?.startsWith('Bearer ')) {
      token = request.headers.authorization.substring(7).trim();
    }

    if (!token) {
      return true;
    }

    try {
      const user = await this.authService.validateAccessToken(token);
      if (user) {
        request.user = user;
      }
    } catch {
      // Ignored for optional session
    }

    return true;
  }
}
