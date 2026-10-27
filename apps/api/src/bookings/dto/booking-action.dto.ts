import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RejectBookingDto {
  @ApiProperty({
    example: 'Chủ xe bận đột xuất vào khung giờ này không thể bàn giao xe',
    description: 'Lý do từ chối yêu cầu đặt xe (1 - 500 ký tự)',
  })
  @IsString()
  @MinLength(1, { message: 'Lý do từ chối không được để trống' })
  @MaxLength(500, { message: 'Lý do từ chối không được vượt quá 500 ký tự' })
  reason!: string;
}

export class CancelBookingDto {
  @ApiProperty({
    example: 'Khách đổi lịch công tác nên cần hủy chuyến',
    description: 'Lý do hủy đơn đặt xe (1 - 500 ký tự)',
  })
  @IsString()
  @MinLength(1, { message: 'Lý do hủy chuyến không được để trống' })
  @MaxLength(500, { message: 'Lý do hủy chuyến không được vượt quá 500 ký tự' })
  reason!: string;
}
