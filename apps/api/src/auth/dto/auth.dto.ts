import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Length, Matches, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Địa chỉ email đăng nhập',
    example: 'owner1@carsharing.local',
  })
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @Transform(({ value }: { value: string }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  @IsNotEmpty({ message: 'Email không được để trống' })
  email!: string;

  @ApiProperty({
    description: 'Mật khẩu tài khoản (tối thiểu 6 ký tự)',
    example: 'DemoPassword123!',
  })
  @IsString({ message: 'Mật khẩu phải là chuỗi' })
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  password!: string;
}

export class RegisterDto {
  @ApiProperty({
    description: 'Họ và tên người dùng (2 - 100 ký tự)',
    example: 'Nguyễn Văn A',
  })
  @IsString({ message: 'Họ tên phải là chuỗi' })
  @Length(2, 100, { message: 'Họ tên phải từ 2 đến 100 ký tự' })
  name!: string;

  @ApiProperty({
    description: 'Địa chỉ email đăng ký',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @Transform(({ value }: { value: string }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  @IsNotEmpty({ message: 'Email không được để trống' })
  email!: string;

  @ApiProperty({
    description: 'Mật khẩu bảo mật (12 - 128 ký tự)',
    example: 'StrongPassword2026!#',
  })
  @IsString({ message: 'Mật khẩu phải là chuỗi' })
  @Length(12, 128, { message: 'Mật khẩu phải từ 12 đến 128 ký tự' })
  password!: string;

  @ApiProperty({
    description: 'Số điện thoại liên hệ (9 - 15 chữ số)',
    example: '0901234567',
  })
  @IsString({ message: 'Số điện thoại phải là chuỗi' })
  @Matches(/^[0-9]{9,15}$/, { message: 'Số điện thoại không hợp lệ' })
  phone!: string;
}

export class UserDto {
  @ApiProperty({
    description: 'ID người dùng (UUID)',
    example: '00000000-0000-0000-0000-000000000001',
  })
  id!: string;

  @ApiProperty({ description: 'Họ và tên', example: 'Nguyễn Văn Chủ 1' })
  name!: string;

  @ApiProperty({ description: 'Email tài khoản', example: 'owner1@carsharing.local' })
  email!: string;

  @ApiProperty({ description: 'Số điện thoại', example: '0901111111' })
  phone!: string;

  @ApiProperty({
    description: 'Trạng thái xác thực bằng lái xe KYC: NONE, PENDING, VERIFIED, REJECTED',
    example: 'VERIFIED',
    enum: ['NONE', 'PENDING', 'VERIFIED', 'REJECTED'],
  })
  kycStatus!: string;

  @ApiProperty({
    description: 'Danh sách năng lực (Capability Model): RENTER, OWNER',
    example: ['RENTER', 'OWNER'],
    isArray: true,
  })
  capabilities!: string[];
}

export class AuthResponseDto {
  @ApiProperty({ description: 'Thông tin tài khoản người dùng', type: () => UserDto })
  user!: UserDto;

  @ApiProperty({ description: 'Mã xác thực chống CSRF gắn phiên', example: 'a1b2c3d4...' })
  csrfToken!: string;
}

export class CsrfResponseDto {
  @ApiProperty({ description: 'CSRF token gắn phiên hoặc trước phiên', example: 'a1b2c3d4...' })
  csrfToken!: string;
}
