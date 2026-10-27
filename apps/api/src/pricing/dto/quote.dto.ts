import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PricingBreakdownDto {
  @ApiProperty({ example: 2, description: 'Số ngày thuê (làm tròn lên theo block 24h)' })
  rentalDays!: number;

  @ApiProperty({ example: 1400000, description: 'Đơn giá thuê theo ngày (VND)' })
  pricePerDayVnd!: number;

  @ApiProperty({
    example: 2800000,
    description: 'Tiền thuê gốc = pricePerDayVnd * rentalDays (VND)',
  })
  baseRentVnd!: number;

  @ApiProperty({ example: 140000, description: 'Phụ phí ngày cao điểm/cuối tuần (VND)' })
  peakSurchargeVnd!: number;

  @ApiProperty({ example: 200000, description: 'Phí bảo hiểm chuyến đi (VND)' })
  insuranceFeeVnd!: number;

  @ApiProperty({ example: 0, description: 'Số tiền giảm giá từ khuyến mãi (VND)' })
  discountVnd!: number;

  @ApiProperty({
    example: 3140000,
    description: 'Tổng phụ = baseRent + peakSurcharge + insuranceFee - discount (VND)',
  })
  subtotalVnd!: number;

  @ApiProperty({
    example: 294000,
    description: 'Phí dịch vụ nền tảng (10% của baseRent + peakSurcharge) (VND)',
  })
  serviceFeeVnd!: number;

  @ApiProperty({
    example: 10000000,
    description: 'Tiền đặt cọc thế chấp giữ xe (hoàn lại sau chuyến đi) (VND)',
  })
  depositVnd!: number;

  @ApiProperty({
    example: 13434000,
    description:
      'Tổng thanh toán = subtotal + serviceFee + deposit (VND, bảo đảm toàn vẹn toán học)',
  })
  totalVnd!: number;
}

export class QuoteDto {
  @ApiProperty({ example: '10000000-0000-0000-0000-000000000001' })
  vehicleId!: string;

  @ApiProperty({ example: '2026-11-01T08:00:00.000Z' })
  startAt!: string;

  @ApiProperty({ example: '2026-11-03T18:00:00.000Z' })
  endAt!: string;

  @ApiProperty({ example: 1400000 })
  pricePerDayVnd!: number;

  @ApiProperty({ example: 2 })
  rentalDays!: number;

  @ApiProperty({ example: 2800000 })
  subtotalVnd!: number;

  @ApiProperty({ example: 280000 })
  serviceFeeVnd!: number;

  @ApiProperty({ example: 10000000 })
  depositVnd!: number;

  @ApiProperty({ example: 13080000 })
  totalVnd!: number;

  @ApiProperty({ example: 'daily-v1' })
  pricingVersion!: string;

  @ApiProperty({ type: PricingBreakdownDto })
  breakdown!: PricingBreakdownDto;

  @ApiProperty({ example: true, description: 'Xe có sẵn sàng trong khoảng thời gian này không' })
  available!: boolean;

  @ApiPropertyOptional({ example: 'Xe đã có lịch đặt trước trong khoảng thời gian này' })
  unavailableReason?: string;
}
