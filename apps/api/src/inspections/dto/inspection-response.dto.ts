import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InspectionType, InspectionAngle } from '@prisma/client';

export class InspectionPhotoDto {
  @ApiProperty({ enum: InspectionAngle, description: 'Góc chụp ảnh' })
  angle!: InspectionAngle;

  @ApiProperty({ description: 'ID của media object', format: 'uuid' })
  mediaId!: string;

  @ApiPropertyOptional({ description: 'Presigned GET URL để xem ảnh bảo mật (TTL 15m)' })
  readUrl?: string;
}

export class InspectionResponseDto {
  @ApiProperty({ description: 'ID của biên bản kiểm tra', format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'ID của chuyến đi booking', format: 'uuid' })
  bookingId!: string;

  @ApiProperty({
    enum: InspectionType,
    description: 'Loại biên bản bàn giao: CHECK_IN hoặc CHECK_OUT',
  })
  type!: InspectionType;

  @ApiProperty({ description: 'Số km trên đồng hồ công tơ mét' })
  odometerKm!: number;

  @ApiProperty({ description: 'Tỷ lệ nhiên liệu / pin (0 - 100%)' })
  fuelPercent!: number;

  @ApiPropertyOptional({ description: 'Ghi chú vết trầy xước, va chạm có sẵn' })
  damageNotes!: string | null;

  @ApiProperty({ description: 'Đã được xác nhận hoàn tất chưa' })
  acknowledged!: boolean;

  @ApiPropertyOptional({ description: 'Thời điểm chốt biên bản bất biến' })
  finalizedAt!: Date | null;

  @ApiProperty({ description: 'Phiên bản concurrency' })
  version!: number;

  @ApiProperty({ description: 'ID người thực hiện kiểm tra', format: 'uuid' })
  performedBy!: string;

  @ApiProperty({ description: 'Thời gian khởi tạo' })
  createdAt!: Date;

  @ApiProperty({
    type: [InspectionPhotoDto],
    description: 'Danh sách ảnh 4 góc xe',
  })
  photos!: InspectionPhotoDto[];
}
