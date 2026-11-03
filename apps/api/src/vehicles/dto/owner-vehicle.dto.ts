import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import { CarType, Transmission, VehicleStatus } from '@prisma/client';

export const ALLOWED_CITIES = ['TP. Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng'] as const;

export function normalizePlate(plate: string): string {
  const clean = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const match = clean.match(/^([0-9]{2}[A-Z]{1,2})([0-9]{4,5})$/);
  if (match) {
    return `${match[1]}-${match[2]}`;
  }
  return clean;
}

export class CreateVehicleDto {
  @ApiProperty({ description: 'Hãng xe', example: 'Toyota' })
  @IsString({ message: 'Hãng xe phải là chuỗi' })
  @Length(2, 50, { message: 'Hãng xe phải từ 2 đến 50 ký tự' })
  @IsNotEmpty({ message: 'Hãng xe không được để trống' })
  brand!: string;

  @ApiProperty({ description: 'Dòng xe / Model', example: 'Corolla Cross' })
  @IsString({ message: 'Model phải là chuỗi' })
  @Length(1, 50, { message: 'Model phải từ 1 đến 50 ký tự' })
  @IsNotEmpty({ message: 'Model không được để trống' })
  model!: string;

  @ApiProperty({ description: 'Năm sản xuất', example: 2023 })
  @IsInt({ message: 'Năm sản xuất phải là số nguyên' })
  @Min(2000, { message: 'Năm sản xuất không được trước năm 2000' })
  @Max(2027, { message: 'Năm sản xuất không hợp lệ' })
  year!: number;

  @ApiProperty({ description: 'Biển số xe', example: '51K-123.45' })
  @IsString({ message: 'Biển số xe phải là chuỗi' })
  @Length(6, 15, { message: 'Biển số xe không hợp lệ' })
  @IsNotEmpty({ message: 'Biển số xe không được để trống' })
  licensePlate!: string;

  @ApiProperty({
    description: 'Thành phố hoạt động',
    example: 'TP. Hồ Chí Minh',
    enum: ALLOWED_CITIES,
  })
  @IsIn(ALLOWED_CITIES, {
    message: 'Thành phố phải là một trong: TP. Hồ Chí Minh, Hà Nội, Đà Nẵng',
  })
  @IsNotEmpty({ message: 'Thành phố không được để trống' })
  city!: string;

  @ApiProperty({
    description: 'Địa chỉ đón/trả xe chính xác',
    example: '123 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh',
  })
  @IsString({ message: 'Địa chỉ đón/trả phải là chuỗi' })
  @Length(5, 255, { message: 'Địa chỉ đón/trả phải từ 5 đến 255 ký tự' })
  @IsNotEmpty({ message: 'Địa chỉ đón/trả không được để trống' })
  pickupAddress!: string;

  @ApiProperty({ description: 'Phân khúc xe', enum: CarType, example: 'SUV' })
  @IsIn(Object.values(CarType), { message: 'Phân khúc xe không hợp lệ' })
  @IsNotEmpty({ message: 'Phân khúc xe không được để trống' })
  carType!: CarType;

  @ApiProperty({ description: 'Hộp số', enum: Transmission, example: 'AUTO' })
  @IsIn(Object.values(Transmission), { message: 'Hộp số phải là AUTO hoặc MANUAL' })
  @IsNotEmpty({ message: 'Hộp số không được để trống' })
  transmission!: Transmission;

  @ApiProperty({ description: 'Số chỗ ngồi', example: 5 })
  @IsInt({ message: 'Số chỗ ngồi phải là số nguyên' })
  @Min(2, { message: 'Số chỗ ngồi tối thiểu là 2' })
  @Max(16, { message: 'Số chỗ ngồi tối đa là 16' })
  seats!: number;

  @ApiProperty({
    description: 'Mô tả chi tiết về xe',
    example: 'Xe gia đình giữ gìn sạch sẽ, bảo dưỡng định kỳ.',
  })
  @IsString({ message: 'Mô tả phải là chuỗi' })
  @Length(10, 2000, { message: 'Mô tả xe phải từ 10 đến 2000 ký tự' })
  @IsNotEmpty({ message: 'Mô tả xe không được để trống' })
  description!: string;

  @ApiProperty({ description: 'Giá thuê một ngày (VND)', example: 1200000 })
  @IsInt({ message: 'Giá thuê phải là số nguyên' })
  @Min(100000, { message: 'Giá thuê tối thiểu 100.000 VND / ngày' })
  @Max(100000000, { message: 'Giá thuê tối đa 100.000.000 VND / ngày' })
  pricePerDayVnd!: number;

  @ApiPropertyOptional({
    description: 'Hỗ trợ nhận xe tự động không chìa (Keyless)',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'keylessSupported phải là boolean' })
  keylessSupported?: boolean;

  @ApiPropertyOptional({
    description: 'Danh sách mã tiện nghi',
    example: ['GPS', 'BLUETOOTH', 'BACKUP_CAMERA'],
  })
  @IsOptional()
  @IsArray({ message: 'Tiện nghi phải là danh sách mảng' })
  @IsString({ each: true, message: 'Mã tiện nghi phải là chuỗi' })
  @ArrayMaxSize(20, { message: 'Tối đa 20 tiện nghi' })
  amenities?: string[];

  @ApiPropertyOptional({
    description: 'Danh sách ID media ảnh xe đã upload và verify',
    example: ['50000000-0000-0000-0000-000000000001'],
  })
  @IsOptional()
  @IsArray({ message: 'photoMediaIds phải là danh sách mảng' })
  @IsUUID('4', { each: true, message: 'ID media phải là UUID v4' })
  @ArrayMaxSize(10, { message: 'Tối đa 10 ảnh xe' })
  photoMediaIds?: string[];
}

export class UpdateVehicleDto {
  @ApiPropertyOptional({ description: 'Hãng xe', example: 'Toyota' })
  @IsOptional()
  @IsString()
  @Length(2, 50)
  brand?: string;

  @ApiPropertyOptional({ description: 'Dòng xe / Model', example: 'Corolla Cross' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  model?: string;

  @ApiPropertyOptional({ description: 'Năm sản xuất', example: 2023 })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2027)
  year?: number;

  @ApiPropertyOptional({ description: 'Thành phố hoạt động', enum: ALLOWED_CITIES })
  @IsOptional()
  @IsIn(ALLOWED_CITIES)
  city?: string;

  @ApiPropertyOptional({ description: 'Địa chỉ đón/trả xe' })
  @IsOptional()
  @IsString()
  @Length(5, 255)
  pickupAddress?: string;

  @ApiPropertyOptional({ description: 'Phân khúc xe', enum: CarType })
  @IsOptional()
  @IsIn(Object.values(CarType))
  carType?: CarType;

  @ApiPropertyOptional({ description: 'Hộp số', enum: Transmission })
  @IsOptional()
  @IsIn(Object.values(Transmission))
  transmission?: Transmission;

  @ApiPropertyOptional({ description: 'Số chỗ ngồi' })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(16)
  seats?: number;

  @ApiPropertyOptional({ description: 'Mô tả chi tiết' })
  @IsOptional()
  @IsString()
  @Length(10, 2000)
  description?: string;

  @ApiPropertyOptional({ description: 'Giá thuê ngày VND', example: 1200000 })
  @IsOptional()
  @IsInt()
  @Min(100000)
  @Max(100000000)
  pricePerDayVnd?: number;

  @ApiPropertyOptional({ description: 'Hỗ trợ Keyless' })
  @IsOptional()
  @IsBoolean()
  keylessSupported?: boolean;

  @ApiPropertyOptional({ description: 'Danh sách mã tiện nghi' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  amenities?: string[];

  @ApiPropertyOptional({ description: 'Danh sách ID media ảnh xe' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(10)
  photoMediaIds?: string[];
}

export class VehiclePhotoDto {
  @ApiProperty({ description: 'ID media' })
  mediaId!: string;

  @ApiProperty({ description: 'Thứ tự hiển thị (0 là ảnh bìa)' })
  position!: number;
}

export class OwnerVehicleDto {
  @ApiProperty({ description: 'ID định danh xe (UUID)' })
  id!: string;

  @ApiProperty({ description: 'ID chủ xe (UUID)' })
  ownerId!: string;

  @ApiProperty({ description: 'Hãng xe' })
  brand!: string;

  @ApiProperty({ description: 'Dòng xe' })
  model!: string;

  @ApiProperty({ description: 'Năm sản xuất' })
  year!: number;

  @ApiProperty({ description: 'Biển số xe đã chuẩn hóa' })
  plateNormalized!: string;

  @ApiProperty({ description: 'Thành phố' })
  city!: string;

  @ApiProperty({ description: 'Địa chỉ đón/trả xe chính xác' })
  pickupAddress!: string;

  @ApiProperty({ description: 'Loại xe', enum: CarType })
  carType!: CarType;

  @ApiProperty({ description: 'Hộp số', enum: Transmission })
  transmission!: Transmission;

  @ApiProperty({ description: 'Số chỗ ngồi' })
  seats!: number;

  @ApiProperty({ description: 'Mô tả xe' })
  description!: string;

  @ApiProperty({ description: 'Giá thuê ngày (VND)' })
  pricePerDayVnd!: number;

  @ApiProperty({ description: 'Hỗ trợ Keyless' })
  keylessSupported!: boolean;

  @ApiProperty({ description: 'Trạng thái xe', enum: VehicleStatus })
  status!: VehicleStatus;

  @ApiProperty({ description: 'Phiên bản concurrency' })
  version!: number;

  @ApiProperty({ description: 'Danh sách tiện nghi', type: [String] })
  amenities!: string[];

  @ApiProperty({ description: 'Danh sách ảnh xe', type: [VehiclePhotoDto] })
  photos!: VehiclePhotoDto[];

  @ApiPropertyOptional({ description: 'Ảnh đại diện xe', type: String, nullable: true })
  coverImageUrl?: string | null;

  @ApiProperty({ description: 'Thời điểm tạo xe' })
  createdAt!: string;

  @ApiProperty({ description: 'Thời điểm cập nhật xe' })
  updatedAt!: string;
}
