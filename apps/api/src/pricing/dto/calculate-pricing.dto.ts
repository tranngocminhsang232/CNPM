import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsEnum, IsString } from 'class-validator';

export enum InsurancePackageTier {
  BASIC = 'BASIC',
  STANDARD = 'STANDARD',
  PREMIUM = 'PREMIUM',
}

export class CalculatePricingDto {
  @ApiProperty({
    example: '10000000-0000-0000-0000-000000000001',
    description: 'Mã định danh xe',
  })
  @IsString()
  vehicleId!: string;

  @ApiProperty({
    example: '2026-11-01T08:00:00.000Z',
    description: 'Thời điểm bắt đầu thuê (ISO 8601 UTC)',
  })
  @IsISO8601()
  startAt!: string;

  @ApiProperty({
    example: '2026-11-03T18:00:00.000Z',
    description: 'Thời điểm kết thúc thuê (ISO 8601 UTC)',
  })
  @IsISO8601()
  endAt!: string;

  @ApiPropertyOptional({
    enum: InsurancePackageTier,
    default: InsurancePackageTier.BASIC,
    description: 'Gói bảo hiểm lựa chọn (BASIC: 0đ, STANDARD: 100k/ngày, PREMIUM: 200k/ngày)',
  })
  @IsOptional()
  @IsEnum(InsurancePackageTier)
  insurancePackage?: InsurancePackageTier = InsurancePackageTier.BASIC;

  @ApiPropertyOptional({
    example: 'SUMMER2026',
    description: 'Mã khuyến mãi giảm giá (nếu có)',
  })
  @IsOptional()
  @IsString()
  voucherCode?: string;
}

export class PricingPreviewQueryDto {
  @ApiProperty({
    example: '2026-11-01T08:00:00.000Z',
    description: 'Thời điểm bắt đầu thuê (ISO 8601 UTC)',
  })
  @IsISO8601()
  startAt!: string;

  @ApiProperty({
    example: '2026-11-03T18:00:00.000Z',
    description: 'Thời điểm kết thúc thuê (ISO 8601 UTC)',
  })
  @IsISO8601()
  endAt!: string;

  @ApiPropertyOptional({
    enum: InsurancePackageTier,
    default: InsurancePackageTier.BASIC,
  })
  @IsOptional()
  @IsEnum(InsurancePackageTier)
  insurancePackage?: InsurancePackageTier = InsurancePackageTier.BASIC;

  @ApiPropertyOptional({
    example: 'SUMMER2026',
  })
  @IsOptional()
  @IsString()
  voucherCode?: string;
}
