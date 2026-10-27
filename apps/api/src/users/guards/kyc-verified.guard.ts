import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../auth/decorators/current-user.decorator';

@Injectable()
export class KycVerifiedGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException({
        message: 'Yêu cầu xác thực giấy phép lái xe (GPLX) trước khi thực hiện hành động này',
        code: 'KYC_REQUIRED',
      });
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { kycStatus: true },
    });

    if (!dbUser || dbUser.kycStatus !== 'VERIFIED') {
      throw new ForbiddenException({
        message:
          'Yêu cầu giấy phép lái xe (GPLX) đã được xác thực trước khi thực hiện hành động này',
        code: 'KYC_REQUIRED',
      });
    }

    return true;
  }
}
