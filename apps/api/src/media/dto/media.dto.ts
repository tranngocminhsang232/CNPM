import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsUUID, Max, Min } from 'class-validator';

export const ALLOWED_MEDIA_MIME_TYPES = ['image/jpeg', 'image/png'] as const;
export const MAX_MEDIA_SIZE_BYTES = 5 * 1024 * 1024; // 5 MiB (BR-11)

export enum MediaPurposeEnum {
  VEHICLE_PHOTO = 'VEHICLE_PHOTO',
  INSPECTION_PHOTO = 'INSPECTION_PHOTO',
  IDENTITY_DOCUMENT = 'IDENTITY_DOCUMENT',
}

export class CreateUploadIntentDto {
  @ApiProperty({
    description: 'Mục đích sử dụng media (VEHICLE_PHOTO, INSPECTION_PHOTO, IDENTITY_DOCUMENT)',
    example: 'IDENTITY_DOCUMENT',
    enum: MediaPurposeEnum,
  })
  @IsIn(Object.values(MediaPurposeEnum), {
    message: 'Mục đích media phải là một trong: VEHICLE_PHOTO, INSPECTION_PHOTO, IDENTITY_DOCUMENT',
  })
  @IsNotEmpty({ message: 'Mục đích media không được để trống' })
  purpose!: MediaPurposeEnum;

  @ApiProperty({
    description: 'Định dạng MIME hợp lệ (chỉ hỗ trợ image/jpeg hoặc image/png)',
    example: 'image/jpeg',
    enum: ALLOWED_MEDIA_MIME_TYPES,
  })
  @IsIn(ALLOWED_MEDIA_MIME_TYPES, {
    message: 'Chỉ chấp nhận định dạng ảnh JPEG hoặc PNG (image/jpeg, image/png)',
  })
  @IsNotEmpty({ message: 'Định dạng MIME không được để trống' })
  mimeType!: string;

  @ApiProperty({
    description: 'Dung lượng file tính bằng bytes (tối đa 5.242.880 bytes ~ 5 MiB)',
    example: 1048576,
  })
  @IsInt({ message: 'Dung lượng file phải là số nguyên' })
  @Min(1, { message: 'Dung lượng file phải lớn hơn 0 bytes' })
  @Max(MAX_MEDIA_SIZE_BYTES, {
    message: 'Dung lượng file không được vượt quá 5 MiB (5.242.880 bytes)',
  })
  sizeBytes!: number;

  @ApiPropertyOptional({
    description: 'ID xe liên quan (nếu là VEHICLE_PHOTO)',
    example: '10000000-0000-0000-0000-000000000001',
  })
  @IsOptional()
  @IsUUID('4', { message: 'vehicleId phải là UUID v4' })
  vehicleId?: string;

  @ApiPropertyOptional({
    description: 'ID booking liên quan (nếu là INSPECTION_PHOTO)',
    example: '20000000-0000-0000-0000-000000000001',
  })
  @IsOptional()
  @IsUUID('4', { message: 'bookingId phải là UUID v4' })
  bookingId?: string;
}

export class UploadIntentResponseDto {
  @ApiProperty({
    description: 'ID định danh duy nhất của media (UUID)',
    example: '50000000-0000-0000-0000-000000000001',
  })
  mediaId!: string;

  @ApiProperty({ description: 'Presigned URL để thực hiện PUT upload trực tiếp lên S3/MinIO' })
  uploadUrl!: string;

  @ApiProperty({
    description: 'Headers bắt buộc phải gửi kèm khi PUT lên S3',
    example: { 'Content-Type': 'image/jpeg' },
  })
  headers!: Record<string, string>;

  @ApiProperty({ description: 'Thời điểm hết hạn của presigned URL upload (ISO 8601 UTC)' })
  expiresAt!: string;
}

export class MediaReadUrlResponseDto {
  @ApiProperty({ description: 'Presigned URL để tải hoặc xem ảnh từ private S3 bucket' })
  url!: string;

  @ApiProperty({ description: 'Thời điểm hết hạn của presigned URL xem file (ISO 8601 UTC)' })
  expiresAt!: string;
}

export class MediaObjectDto {
  @ApiProperty({ description: 'ID media (UUID)', example: '50000000-0000-0000-0000-000000000001' })
  id!: string;

  @ApiProperty({
    description: 'ID người tải lên (UUID)',
    example: '00000000-0000-0000-0000-000000000001',
  })
  uploaderId!: string;

  @ApiProperty({ description: 'Mục đích sử dụng media', example: 'IDENTITY_DOCUMENT' })
  purpose!: string;

  @ApiProperty({ description: 'Định dạng MIME', example: 'image/jpeg' })
  mimeType!: string;

  @ApiProperty({ description: 'Dung lượng bytes', example: 1048576 })
  sizeBytes!: number;

  @ApiProperty({
    description: 'Trạng thái media',
    example: 'VERIFIED',
    enum: ['STAGING', 'VERIFIED', 'REJECTED'],
  })
  state!: string;

  @ApiPropertyOptional({ description: 'Thời điểm xác minh file', type: String, nullable: true })
  verifiedAt?: string | null;
}
