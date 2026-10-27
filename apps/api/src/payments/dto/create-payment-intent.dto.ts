import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { PaymentType } from '@prisma/client';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CreatePaymentIntentDto {
  @ApiProperty({
    example: '20000000-0000-0000-0000-000000000001',
    description: 'Mã định danh đơn đặt xe (UUID)',
  })
  @Matches(UUID_PATTERN, { message: 'bookingId phải là chuỗi UUID hợp lệ' })
  bookingId!: string;

  @ApiPropertyOptional({
    enum: PaymentType,
    default: PaymentType.DEPOSIT,
    description: 'Loại thanh toán: DEPOSIT (tiền cọc giữ chỗ), FULL_PAYMENT (toàn bộ)',
  })
  @IsOptional()
  @IsEnum(PaymentType)
  paymentType: PaymentType = PaymentType.DEPOSIT;

  @ApiPropertyOptional({
    example: 'http://localhost:3000/bookings/20000000-0000-0000-0000-000000000001',
    description: 'URL chuyển hướng sau khi hoàn tất thanh toán',
  })
  @IsOptional()
  @IsString()
  returnUrl?: string;
}
