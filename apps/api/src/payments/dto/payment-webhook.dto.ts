import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PaymentStatus } from '@prisma/client';

export class PaymentWebhookDto {
  @ApiProperty({
    example: 'TX-1730000000-a1b2c3d4',
    description: 'Mã đối soát giao dịch',
  })
  @IsString()
  transactionRef!: string;

  @ApiPropertyOptional({
    example: 'VNP-20261027-998877',
    description: 'Mã giao dịch từ cổng thanh toán đối tác',
  })
  @IsOptional()
  @IsString()
  gatewayTxnId?: string;

  @ApiProperty({
    example: 10000000,
    description: 'Số tiền giao dịch thực tế (VND)',
  })
  @IsNumber()
  @Min(1)
  amountVnd!: number;

  @ApiProperty({
    enum: PaymentStatus,
    example: PaymentStatus.SUCCESS,
    description: 'Trạng thái kết quả từ cổng thanh toán',
  })
  @IsEnum(PaymentStatus)
  status!: PaymentStatus;

  @ApiProperty({
    example: 'a5d89f...',
    description: 'Chữ ký số HMAC-SHA512 để xác thực tính toàn vẹn',
  })
  @IsString()
  signature!: string;
}

export class SimulatePaymentDto {
  @ApiProperty({
    example: 'TX-1730000000-a1b2c3d4',
    description: 'Mã tham chiếu giao dịch cần giả lập',
  })
  @IsString()
  transactionRef!: string;

  @ApiProperty({
    enum: PaymentStatus,
    example: PaymentStatus.SUCCESS,
    description: 'Trạng thái muốn giả lập',
  })
  @IsEnum(PaymentStatus)
  status!: PaymentStatus;
}
