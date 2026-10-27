import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, Min, IsOptional, IsString, MaxLength } from 'class-validator';

export class SettleDepositDto {
  @ApiPropertyOptional({
    description: 'Phí vệ sinh nếu xe bị bẩn quá mức quy định (VND)',
    example: 100000,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  cleaningFeeVnd?: number;

  @ApiPropertyOptional({
    description: 'Phụ phí phát sinh khác (ví dụ đền bù xước nhỏ, trễ giờ...) (VND)',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  otherSurchargeVnd?: number;

  @ApiPropertyOptional({
    description: 'Ghi chú lý do khấu trừ hoặc nghiệm thu hoàn cọc',
    example: 'Khấu trừ 5% nhiên liệu hao hụt và phí rửa xe',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  damageNotes?: string;
}

export class SurchargeBreakdownDto {
  @ApiProperty({ description: 'Phần trăm nhiên liệu/pin bị hao hụt so với lúc nhận', example: 5 })
  fuelShortfallPercent!: number;

  @ApiProperty({ description: 'Đơn giá bù nhiên liệu / 1% (VND)', example: 30000 })
  fuelUnitPriceVnd!: number;

  @ApiProperty({ description: 'Tiền phụ thu nhiên liệu hao hụt (VND)', example: 150000 })
  fuelSurchargeVnd!: number;

  @ApiProperty({ description: 'Phí vệ sinh (VND)', example: 100000 })
  cleaningFeeVnd!: number;

  @ApiProperty({ description: 'Phụ phí phát sinh khác (VND)', example: 0 })
  otherSurchargeVnd!: number;

  @ApiProperty({ description: 'Tổng toàn bộ phụ phí khấu trừ (VND)', example: 250000 })
  totalSurchargesVnd!: number;

  @ApiPropertyOptional({ description: 'Ghi chú giải trình của chủ xe' })
  damageNotes?: string | null;
}

export class DepositSettlementResponseDto {
  @ApiProperty({ description: 'ID chuyến đi' })
  bookingId!: string;

  @ApiProperty({ description: 'Số tiền ký quỹ ban đầu (VND)', example: 10000000 })
  depositVnd!: number;

  @ApiProperty({ description: 'Chi tiết bóc tách phụ phí phát sinh' })
  breakdown!: SurchargeBreakdownDto;

  @ApiProperty({ description: 'Số tiền hoàn trả lại cho khách thuê (VND)', example: 9750000 })
  refundAmountVnd!: number;

  @ApiProperty({
    description: 'Trạng thái quyết toán cọc',
    example: 'SETTLED',
    enum: ['SETTLED', 'PENDING'],
  })
  status!: 'SETTLED' | 'PENDING';

  @ApiPropertyOptional({ description: 'Mã giao dịch hoàn tiền nếu có' })
  refundTransactionRef?: string | null;

  @ApiPropertyOptional({ description: 'Thời điểm quyết toán hoàn tất' })
  settledAt?: string | null;
}
