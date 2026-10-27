import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { InspectionType } from '@prisma/client';

export class FinalizeInspectionDto {
  @ApiProperty({
    enum: InspectionType,
    description: 'Loại biên bản cần chốt: CHECK_IN hoặc CHECK_OUT',
  })
  @IsEnum(InspectionType)
  @IsNotEmpty()
  type!: InspectionType;
}
