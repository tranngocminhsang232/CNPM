import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InspectionType, InspectionAngle } from '@prisma/client';

export class InspectionPhotoInputDto {
  @ApiProperty({ enum: InspectionAngle, description: 'Góc chụp ảnh kiểm tra xe' })
  @IsEnum(InspectionAngle)
  @IsNotEmpty()
  angle!: InspectionAngle;

  @ApiProperty({ description: 'ID của media đã được xác thực trên storage', format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  mediaId!: string;
}

export class SaveInspectionDto {
  @ApiProperty({
    enum: InspectionType,
    description: 'Loại biên bản bàn giao: CHECK_IN hoặc CHECK_OUT',
  })
  @IsEnum(InspectionType)
  @IsNotEmpty()
  type!: InspectionType;

  @ApiProperty({ description: 'Số km trên đồng hồ công tơ mét', minimum: 0, default: 0 })
  @IsInt()
  @Min(0)
  odometerKm!: number;

  @ApiProperty({
    description: 'Tỷ lệ nhiên liệu / pin (0 - 100%)',
    minimum: 0,
    maximum: 100,
    default: 100,
  })
  @IsInt()
  @Min(0)
  @Max(100)
  fuelPercent!: number;

  @ApiPropertyOptional({ description: 'Ghi chú vết trầy xước, va chạm có sẵn', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  damageNotes?: string;

  @ApiPropertyOptional({
    description: 'Phiên bản concurrency phục vụ optimistic locking',
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;

  @ApiProperty({
    type: [InspectionPhotoInputDto],
    description: 'Danh sách các ảnh chụp theo từng góc',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InspectionPhotoInputDto)
  photos!: InspectionPhotoInputDto[];
}
