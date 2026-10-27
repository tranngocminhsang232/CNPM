import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { BookingStatus } from '@prisma/client';

export enum BookingPerspective {
  RENTER = 'renter',
  OWNER = 'owner',
}

export class QueryBookingsDto {
  @ApiPropertyOptional({
    enum: BookingPerspective,
    default: BookingPerspective.RENTER,
    description: 'Góc nhìn tra cứu: renter (khách thuê) hoặc owner (chủ xe)',
  })
  @IsOptional()
  @IsEnum(BookingPerspective)
  perspective?: BookingPerspective = BookingPerspective.RENTER;

  @ApiPropertyOptional({
    enum: BookingStatus,
    description:
      'Lọc theo trạng thái đơn thuê (REQUESTED, APPROVED, REJECTED, IN_PROGRESS, COMPLETED, CANCELLED, EXPIRED)',
  })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @ApiPropertyOptional({
    default: 1,
    description: 'Số thứ tự trang',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    default: 10,
    description: 'Số lượng bản ghi mỗi trang',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number = 10;
}
