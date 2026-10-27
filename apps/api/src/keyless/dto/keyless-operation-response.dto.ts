import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus, KeylessAction, KeylessOperationStatus } from '@prisma/client';

export class KeylessOperationResponseDto {
  @ApiProperty({ description: 'ID định danh duy nhất của lệnh điều khiển', format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'ID chuyến đi booking', format: 'uuid' })
  bookingId!: string;

  @ApiProperty({ description: 'ID người gửi lệnh điều khiển (@CurrentUser)', format: 'uuid' })
  actorId!: string;

  @ApiProperty({ description: 'Hành động điều khiển xe', enum: KeylessAction })
  action!: KeylessAction;

  @ApiProperty({ description: 'Khóa chống trùng lặp Idempotency-Key' })
  idempotencyKey!: string;

  @ApiProperty({ description: 'Trạng thái lệnh điều khiển', enum: KeylessOperationStatus })
  status!: KeylessOperationStatus;

  @ApiProperty({
    description: 'Nhà cung cấp phần cứng điều khiển xe (SIMULATOR)',
    example: 'SIMULATOR',
  })
  provider!: string;

  @ApiPropertyOptional({ description: 'Chi tiết phản hồi từ phần cứng xe dạng JSON' })
  deviceResult?: string | null;

  @ApiPropertyOptional({ description: 'Thời điểm hoàn tất xử lý lệnh', format: 'date-time' })
  resolvedAt?: Date | null;

  @ApiProperty({ description: 'Thời điểm tạo lệnh', format: 'date-time' })
  createdAt!: Date;

  @ApiPropertyOptional({
    description: 'Trạng thái hiện tại của chuyến đi booking sau khi xử lý lệnh',
    enum: BookingStatus,
  })
  bookingStatus?: BookingStatus;

  @ApiPropertyOptional({
    description: 'Cờ báo hiệu kết quả replayed do trùng khớp Idempotency-Key',
    example: false,
  })
  isReplay?: boolean;
}
