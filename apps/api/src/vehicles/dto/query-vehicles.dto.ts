import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsISO8601,
  IsArray,
} from 'class-validator';
import { CarType, Transmission } from '@prisma/client';

export enum VehicleSortOption {
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  NEWEST = 'newest',
  RATING_DESC = 'rating_desc',
  POPULARITY_DESC = 'popularity_desc',
}

export class QueryVehiclesDto {
  @ApiPropertyOptional({
    description: 'Từ khóa tìm kiếm theo hãng (brand) hoặc mẫu xe (model)',
    example: 'VinFast',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Hãng sản xuất (brand)', example: 'Toyota' })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({ description: 'Tỉnh / thành phố tìm kiếm', example: 'TP. Hồ Chí Minh' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    description: 'Thời điểm bắt đầu thuê (ISO 8601)',
    example: '2026-11-01T08:00:00Z',
  })
  @IsOptional()
  @IsISO8601()
  startAt?: string;

  @ApiPropertyOptional({
    description: 'Thời điểm kết thúc thuê (ISO 8601)',
    example: '2026-11-03T18:00:00Z',
  })
  @IsOptional()
  @IsISO8601()
  endAt?: string;

  @ApiPropertyOptional({ enum: CarType, description: 'Phân khúc xe' })
  @IsOptional()
  @IsEnum(CarType)
  carType?: CarType;

  @ApiPropertyOptional({ enum: Transmission, description: 'Hộp số' })
  @IsOptional()
  @IsEnum(Transmission)
  transmission?: Transmission;

  @ApiPropertyOptional({ description: 'Số chỗ ngồi tối thiểu', example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  seats?: number;

  @ApiPropertyOptional({ description: 'Giá thuê ngày tối thiểu (VND)', example: 500000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Giá thuê ngày tối đa (VND)', example: 3000000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ description: 'Chỉ tìm xe hỗ trợ tự mở khóa Keyless', example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true || value === 1 || value === '1')
  @IsBoolean()
  keylessOnly?: boolean;

  @ApiPropertyOptional({
    description:
      'Lọc theo danh sách tiện nghi (mảng hoặc phân cách bởi dấu phẩy, e.g. GPS,BACKUP_CAMERA)',
    example: ['GPS', 'BACKUP_CAMERA'],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return undefined;
  })
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @ApiPropertyOptional({
    enum: VehicleSortOption,
    description: 'Sắp xếp kết quả',
    default: VehicleSortOption.NEWEST,
  })
  @IsOptional()
  @IsEnum(VehicleSortOption)
  sort?: VehicleSortOption = VehicleSortOption.NEWEST;

  @ApiPropertyOptional({ description: 'Số trang (1-indexed)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Số xe trên một trang', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number = 10;
}
