import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export const ALLOWED_LICENSE_CLASSES = [
  'B1',
  'B2',
  'C',
  'D',
  'E',
  'FB2',
  'FC',
  'FD',
  'FE',
] as const;

export class SubmitDriverLicenseDto {
  @ApiProperty({
    description: 'Số Giấy phép lái xe (đúng 12 chữ số chuẩn Việt Nam)',
    example: '079199012345',
  })
  @IsString({ message: 'Số GPLX phải là chuỗi' })
  @Matches(/^[0-9]{12}$/, { message: 'Số GPLX phải gồm đúng 12 chữ số' })
  @IsNotEmpty({ message: 'Số GPLX không được để trống' })
  licenseNumber!: string;

  @ApiProperty({
    description: 'Họ và tên ghi trên GPLX (2 - 100 ký tự)',
    example: 'NGUYỄN VĂN CHỦ',
  })
  @IsString({ message: 'Họ tên phải là chuỗi' })
  @Length(2, 100, { message: 'Họ tên phải từ 2 đến 100 ký tự' })
  @Transform(({ value }: { value: string }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsNotEmpty({ message: 'Họ tên không được để trống' })
  fullName!: string;

  @ApiProperty({
    description: 'Ngày sinh định dạng ISO 8601 (YYYY-MM-DD)',
    example: '1995-05-15',
  })
  @IsDateString({}, { message: 'Ngày sinh phải đúng định dạng ngày YYYY-MM-DD' })
  @IsNotEmpty({ message: 'Ngày sinh không được để trống' })
  dateOfBirth!: string;

  @ApiProperty({
    description: 'Hạng GPLX hợp lệ (B1, B2, C, D, E, FB2, FC, FD, FE)',
    example: 'B2',
    enum: ALLOWED_LICENSE_CLASSES,
  })
  @IsString({ message: 'Hạng GPLX phải là chuỗi' })
  @IsIn(ALLOWED_LICENSE_CLASSES, {
    message: 'Hạng GPLX phải là một trong: B1, B2, C, D, E, FB2, FC, FD, FE',
  })
  @Transform(({ value }: { value: string }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  licenseClass!: string;

  @ApiProperty({
    description: 'Ngày hết hạn GPLX (bắt buộc còn hạn ít nhất 30 ngày)',
    example: '2030-05-15',
  })
  @IsDateString({}, { message: 'Ngày hết hạn phải đúng định dạng ngày YYYY-MM-DD' })
  @IsNotEmpty({ message: 'Ngày hết hạn không được để trống' })
  expiryDate!: string;
}

export class VerifyDriverLicenseDto {
  @ApiProperty({
    description: 'Trạng thái xác thực GPLX',
    example: 'VERIFIED',
    enum: ['VERIFIED', 'REJECTED'],
  })
  @IsIn(['VERIFIED', 'REJECTED'], { message: 'Trạng thái phải là VERIFIED hoặc REJECTED' })
  status!: 'VERIFIED' | 'REJECTED';

  @ApiPropertyOptional({
    description: 'Lý do từ chối (bắt buộc nếu REJECTED)',
    example: 'Ảnh chụp GPLX bị mờ, không rõ số hiệu',
  })
  @IsOptional()
  @IsString({ message: 'Lý do từ chối phải là chuỗi' })
  rejectionReason?: string;
}

export class DriverLicenseDto {
  @ApiProperty({
    description: 'ID hồ sơ GPLX (UUID)',
    example: '40000000-0000-0000-0000-000000000001',
  })
  id!: string;

  @ApiProperty({
    description: 'ID chủ tài khoản (UUID)',
    example: '00000000-0000-0000-0000-000000000001',
  })
  userId!: string;

  @ApiProperty({ description: 'Số Giấy phép lái xe', example: '079199012345' })
  licenseNumber!: string;

  @ApiProperty({ description: 'Họ và tên người lái xe', example: 'NGUYỄN VĂN CHỦ' })
  fullName!: string;

  @ApiProperty({ description: 'Ngày sinh (YYYY-MM-DD)', example: '1995-05-15' })
  dateOfBirth!: string;

  @ApiProperty({ description: 'Hạng GPLX', example: 'B2' })
  licenseClass!: string;

  @ApiProperty({ description: 'Ngày hết hạn (YYYY-MM-DD)', example: '2030-05-15' })
  expiryDate!: string;

  @ApiProperty({
    description: 'Trạng thái xác thực KYC',
    example: 'PENDING',
    enum: ['NONE', 'PENDING', 'VERIFIED', 'REJECTED'],
  })
  status!: string;

  @ApiPropertyOptional({ description: 'Thời điểm duyệt xác minh', type: String, nullable: true })
  verifiedAt?: string | null;

  @ApiPropertyOptional({ description: 'Lý do từ chối xác thực', type: String, nullable: true })
  rejectionReason?: string | null;
}
