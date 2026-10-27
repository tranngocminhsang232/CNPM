import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  Res,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiCookieAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { QueryBookingsDto } from './dto/query-bookings.dto';
import { RejectBookingDto, CancelBookingDto } from './dto/booking-action.dto';
import { BookingResponseDto } from './dto/booking-response.dto';
import { SessionGuard } from '../auth/guards/session.guard';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { KycVerifiedGuard } from '../users/guards/kyc-verified.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe';

@ApiTags('Bookings')
@ApiCookieAuth()
@Controller('bookings')
@UseGuards(SessionGuard, CsrfGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @UseGuards(KycVerifiedGuard)
  @ApiOperation({
    summary: 'Tạo yêu cầu đặt xe mới (Idempotent)',
    description:
      'Tạo đơn đặt xe với trạng thái REQUESTED, khóa lịch xe tự động, lưu snapshot biểu phí bất biến. Yêu cầu tài khoản đã KYC và có header Idempotency-Key.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Khóa chống trùng lặp (16 - 128 ký tự ASCII)',
  })
  @ApiResponse({
    status: 201,
    description: 'Tạo đơn đặt xe mới thành công',
    type: BookingResponseDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Replay yêu cầu đặt xe trùng lặp (Idempotent)',
    type: BookingResponseDto,
  })
  async createBooking(
    @CurrentUser('id') actorId: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: CreateBookingDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<BookingResponseDto> {
    const result = await this.bookingsService.createBooking(actorId, idempotencyKey, dto);
    res.status(result.isReplay ? HttpStatus.OK : HttpStatus.CREATED);
    return result.booking;
  }

  @Get()
  @ApiOperation({
    summary: 'Tra cứu danh sách đơn đặt xe (Khách thuê hoặc Chủ xe)',
    description:
      'Lấy danh sách các đơn đặt xe thuộc quyền sở hữu của người dùng hiện tại theo góc nhìn renter hoặc owner.',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách đơn đặt xe kèm phân trang',
  })
  async getBookings(@CurrentUser('id') actorId: string, @Query() query: QueryBookingsDto) {
    return this.bookingsService.getBookings(actorId, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Xem chi tiết đơn đặt xe',
    description:
      'Chỉ khách thuê hoặc chủ xe liên quan mới có quyền xem thông tin chi tiết đơn này.',
  })
  @ApiResponse({
    status: 200,
    description: 'Thông tin chi tiết đơn thuê, xe, biểu phí và hai bên tham gia',
    type: BookingResponseDto,
  })
  async getBookingById(
    @CurrentUser('id') actorId: string,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.getBookingById(id, actorId);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Chủ xe phê duyệt đơn đặt xe',
    description: 'Chuyển trạng thái đơn từ REQUESTED sang APPROVED.',
  })
  @ApiResponse({
    status: 200,
    description: 'Phê duyệt thành công',
    type: BookingResponseDto,
  })
  async approveBooking(
    @CurrentUser('id') actorId: string,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.approveBooking(id, actorId);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Chủ xe từ chối đơn đặt xe',
    description:
      'Chuyển trạng thái đơn sang REJECTED, tự động giải phóng lịch xe và hoàn lại voucher nếu có.',
  })
  @ApiResponse({
    status: 200,
    description: 'Từ chối thành công, lịch xe đã được mở lại',
    type: BookingResponseDto,
  })
  async rejectBooking(
    @CurrentUser('id') actorId: string,
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: RejectBookingDto,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.rejectBooking(id, actorId, dto.reason);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Hủy đơn đặt xe (Khách thuê hoặc Chủ xe)',
    description:
      'Chuyển trạng thái đơn sang CANCELLED, giải phóng lịch xe và hoàn trả voucher nếu có.',
  })
  @ApiResponse({
    status: 200,
    description: 'Hủy đơn thành công, lịch xe đã được mở lại',
    type: BookingResponseDto,
  })
  async cancelBooking(
    @CurrentUser('id') actorId: string,
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: CancelBookingDto,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.cancelBooking(id, actorId, dto.reason);
  }
}
