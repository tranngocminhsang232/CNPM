import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CsrfGuard } from './guards/csrf.guard';
import { SessionGuard } from './guards/session.guard';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, SessionGuard, CsrfGuard],
  exports: [AuthService, SessionGuard, CsrfGuard],
})
export class AuthModule {}
