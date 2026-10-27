import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PricingModule } from '../pricing/pricing.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { PaymentsModule } from '../payments/payments.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [PrismaModule, PricingModule, PromotionsModule, AuthModule, UsersModule, PaymentsModule],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
