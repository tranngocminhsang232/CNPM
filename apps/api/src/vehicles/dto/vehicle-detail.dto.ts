import { ApiProperty } from '@nestjs/swagger';
import { CarType, Transmission } from '@prisma/client';

export class VehicleOwnerSummaryDto {
  @ApiProperty({ example: '00000000-0000-0000-0000-000000000001' })
  id!: string;

  @ApiProperty({ example: 'Chủ 1' })
  name!: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  joinedAt!: string;
}

export class VehicleDetailDto {
  @ApiProperty({ example: '10000000-0000-0000-0000-000000000001' })
  id!: string;

  @ApiProperty({ example: 'VinFast' })
  brand!: string;

  @ApiProperty({ example: 'VF8 Plus' })
  model!: string;

  @ApiProperty({ example: 2024 })
  year!: number;

  @ApiProperty({ example: 'TP. Hồ Chí Minh' })
  city!: string;

  @ApiProperty({ enum: CarType, example: 'SUV' })
  carType!: CarType;

  @ApiProperty({ enum: Transmission, example: 'AUTO' })
  transmission!: Transmission;

  @ApiProperty({ example: 5 })
  seats!: number;

  @ApiProperty({ example: 'Xe mới, bảo dưỡng định kỳ chính hãng, động cơ điện êm ái.' })
  description!: string;

  @ApiProperty({ example: ['GPS', 'BLUETOOTH', 'BACKUP_CAMERA'] })
  amenities!: string[];

  @ApiProperty({ example: ['http://localhost:4000/api/v1/media/vehicles/photo1.jpg'] })
  photoUrls!: string[];

  @ApiProperty({ example: true })
  keylessSupported!: boolean;

  @ApiProperty({ example: 1400000, description: 'Giá thuê một ngày (VND)' })
  pricePerDayVnd!: number;

  @ApiProperty({ example: 5.0, description: 'Điểm đánh giá trung bình' })
  ratingAverage!: number;

  @ApiProperty({ example: 12, description: 'Tổng số lượt đánh giá' })
  reviewCount!: number;

  @ApiProperty({ example: 15, description: 'Tổng số chuyến đi đã hoàn thành' })
  totalTrips!: number;

  @ApiProperty({ type: VehicleOwnerSummaryDto })
  owner!: VehicleOwnerSummaryDto;
}
