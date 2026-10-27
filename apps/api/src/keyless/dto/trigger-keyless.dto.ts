import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { KeylessAction } from '@prisma/client';

export class TriggerKeylessDto {
  @ApiProperty({
    description: 'Hành động điều khiển khóa xe (LOCK hoặc UNLOCK)',
    enum: KeylessAction,
    example: KeylessAction.UNLOCK,
  })
  @IsEnum(KeylessAction, { message: 'action phải là LOCK hoặc UNLOCK' })
  @IsNotEmpty({ message: 'action không được để trống' })
  action!: KeylessAction;

  @ApiPropertyOptional({
    description:
      'Cờ thử nghiệm giả lập kết quả phần cứng (chỉ áp dụng ở môi trường dev/test: SUCCESS, FAILED, UNKNOWN)',
    enum: ['SUCCESS', 'FAILED', 'UNKNOWN'],
    example: 'SUCCESS',
  })
  @IsOptional()
  @IsString()
  simulateResult?: 'SUCCESS' | 'FAILED' | 'UNKNOWN';
}
