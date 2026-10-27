import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CsrfGuard } from './guards/csrf.guard';
import { OptionalSessionGuard } from './guards/optional-session.guard';
import { SessionGuard } from './guards/session.guard';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, SessionGuard, OptionalSessionGuard, CsrfGuard],
  exports: [AuthService, SessionGuard, OptionalSessionGuard, CsrfGuard],
})
export class AuthModule {}
