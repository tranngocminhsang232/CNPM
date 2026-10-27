import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { KycVerifiedGuard } from './guards/kyc-verified.guard';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [UsersController],
  providers: [UsersService, KycVerifiedGuard],
  exports: [UsersService, KycVerifiedGuard],
})
export class UsersModule {}
