import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CarType, Transmission } from '@prisma/client';

export class VehicleSummaryDto {
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

  @ApiProperty({ example: ['GPS', 'BLUETOOTH', 'BACKUP_CAMERA'] })
  amenities!: string[];

  @ApiProperty({ example: true })
  keylessSupported!: boolean;

  @ApiProperty({ example: 1400000, description: 'Giá thuê một ngày (VND, số nguyên an toàn)' })
  pricePerDayVnd!: number;

  @ApiPropertyOptional({
    type: String,
    example:
      'http://localhost:4000/api/v1/media/vehicles/10000000-0000-0000-0000-000000000001/cover.jpg',
    nullable: true,
  })
  coverImageUrl!: string | null;

  @ApiProperty({ example: 5.0, description: 'Điểm đánh giá trung bình' })
  ratingAverage!: number;

  @ApiProperty({ example: 0, description: 'Tổng số lượt đánh giá' })
  reviewCount!: number;

  @ApiPropertyOptional({ description: 'Báo giá tính nhanh (nếu có yêu cầu khoảng ngày)' })
  quote?: {
    rentalDays: number;
    subtotalVnd: number;
    totalVnd: number;
  };
}

export class PaginationMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  pageSize!: number;

  @ApiProperty({ example: 12 })
  total!: number;

  @ApiProperty({ example: 2 })
  totalPages!: number;
}
