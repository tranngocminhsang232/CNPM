import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';
import { InsurancePackageTier } from '../../pricing/dto/calculate-pricing.dto';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CreateBookingDto {
  @ApiProperty({
    example: '10000000-0000-0000-0000-000000000001',
    description: 'Mã định danh xe muốn thuê (UUID)',
  })
  @Matches(UUID_PATTERN, { message: 'vehicleId phải là định dạng UUID hợp lệ' })
  vehicleId!: string;

  @ApiProperty({
    example: '2026-11-10T08:00:00.000Z',
    description: 'Thời điểm nhận xe (ISO 8601 UTC)',
  })
  @IsISO8601()
  startAt!: string;

  @ApiProperty({
    example: '2026-11-12T18:00:00.000Z',
    description: 'Thời điểm trả xe (ISO 8601 UTC)',
  })
  @IsISO8601()
  endAt!: string;

  @ApiProperty({
    example: 3380000,
    description: 'Tổng tiền dự kiến (VND) để bảo vệ chống trượt giá',
  })
  @IsNumber()
  @Min(1)
  expectedTotalVnd!: number;

  @ApiPropertyOptional({
    example: 'daily-v1',
    default: 'daily-v1',
    description: 'Phiên bản biểu phí áp dụng',
  })
  @IsOptional()
  @IsString()
  pricingVersion: string = 'daily-v1';

  @ApiPropertyOptional({
    enum: InsurancePackageTier,
    default: InsurancePackageTier.BASIC,
    description: 'Gói bảo hiểm lựa chọn (BASIC, STANDARD, PREMIUM)',
  })
  @IsOptional()
  @IsEnum(InsurancePackageTier)
  insurancePackage?: InsurancePackageTier = InsurancePackageTier.BASIC;

  @ApiPropertyOptional({
    example: 'WELCOME2026',
    description: 'Mã khuyến mãi áp dụng giảm giá (nếu có)',
  })
  @IsOptional()
  @IsString()
  voucherCode?: string;
}
