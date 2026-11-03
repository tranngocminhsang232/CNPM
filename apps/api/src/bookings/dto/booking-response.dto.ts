import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';

export class BookingVehicleSummaryDto {
  @ApiProperty({ example: '10000000-0000-0000-0000-000000000001' })
  id!: string;

  @ApiProperty({ example: 'VinFast' })
  brand!: string;

  @ApiProperty({ example: 'VF8 Plus' })
  model!: string;

  @ApiProperty({ example: 2024 })
  year!: number;

  @ApiPropertyOptional({ example: '51K-10001', nullable: true })
  plateNormalized?: string | null;

  @ApiProperty({ example: 'TP. Hồ Chí Minh' })
  city!: string;

  @ApiPropertyOptional({
    example: 'Vinhomes Central Park, 208 Nguyễn Hữu Cảnh, Quận Bình Thạnh',
    nullable: true,
  })
  pickupAddress?: string | null;

  @ApiProperty({ example: 1400000 })
  pricePerDayVnd!: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  coverImageUrl?: string | null;

  @ApiProperty({ example: true })
  keylessSupported!: boolean;
}

export class PricingSnapshotDto {
  @ApiProperty({ example: 'VND' })
  currency!: string;

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
}

export class BookingUserSummaryDto {
  @ApiProperty({ example: '00000000-0000-0000-0000-000000000001' })
  id!: string;

  @ApiProperty({ example: 'Chủ 1' })
  name!: string;

  @ApiProperty({ example: '0901111111' })
  phone!: string;
}

export class BookingResponseDto {
  @ApiProperty({ example: '20000000-0000-0000-0000-000000000001' })
  id!: string;

  @ApiProperty({ example: '10000000-0000-0000-0000-000000000001' })
  vehicleId!: string;

  @ApiProperty({ example: '00000000-0000-0000-0000-000000000003' })
  renterId!: string;

  @ApiProperty({ example: '00000000-0000-0000-0000-000000000001' })
  ownerId!: string;

  @ApiProperty({ example: '2026-11-10T08:00:00.000Z' })
  startAt!: string;

  @ApiProperty({ example: '2026-11-12T18:00:00.000Z' })
  endAt!: string;

  @ApiProperty({ enum: BookingStatus, example: BookingStatus.REQUESTED })
  status!: BookingStatus;

  @ApiProperty({ example: '2026-11-10T08:15:00.000Z' })
  requestExpiresAt!: string;

  @ApiPropertyOptional({ nullable: true })
  completedAt?: string | null;

  @ApiPropertyOptional({ nullable: true })
  reason?: string | null;

  @ApiProperty({ example: 1 })
  version!: number;

  @ApiProperty({ example: '2026-10-27T10:00:00.000Z' })
  createdAt!: string;

  @ApiPropertyOptional({ type: () => BookingVehicleSummaryDto })
  vehicle?: BookingVehicleSummaryDto;

  @ApiPropertyOptional({ type: () => PricingSnapshotDto, nullable: true })
  pricingSnapshot?: PricingSnapshotDto | null;

  @ApiPropertyOptional({ type: () => BookingUserSummaryDto })
  renter?: BookingUserSummaryDto;

  @ApiPropertyOptional({ type: () => BookingUserSummaryDto })
  owner?: BookingUserSummaryDto;
}
