import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatus, PaymentType } from '@prisma/client';

export class PaymentResponseDto {
  @ApiProperty({ example: '50000000-0000-0000-0000-000000000001' })
  id!: string;

  @ApiProperty({ example: '20000000-0000-0000-0000-000000000001' })
  bookingId!: string;

  @ApiProperty({ example: '00000000-0000-0000-0000-000000000003' })
  renterId!: string;

  @ApiProperty({ example: 10000000, description: 'Số tiền thanh toán (VND)' })
  amountVnd!: number;

  @ApiProperty({ enum: PaymentType, example: PaymentType.DEPOSIT })
  paymentType!: PaymentType;

  @ApiProperty({ enum: PaymentStatus, example: PaymentStatus.PENDING })
  status!: PaymentStatus;

  @ApiProperty({ example: 'SANDBOX_GATEWAY' })
  provider!: string;

  @ApiProperty({ example: 'TX-1730000000-a1b2c3d4' })
  transactionRef!: string;

  @ApiPropertyOptional({ example: '/checkout/payment-gateway?ref=TX-1730000000-a1b2c3d4' })
  paymentUrl?: string | null;

  @ApiPropertyOptional({ example: 'VNP-20261027-998877', nullable: true })
  gatewayTxnId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  paidAt?: string | null;

  @ApiProperty({ example: '2026-10-27T10:00:00.000Z' })
  createdAt!: string;
}
