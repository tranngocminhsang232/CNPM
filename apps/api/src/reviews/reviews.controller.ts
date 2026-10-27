import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewResponseDto, VehicleReviewsSummaryDto } from './dto/review-response.dto';
import { SessionGuard } from '../auth/guards/session.guard';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe';

@ApiTags('Reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post('bookings/:id/reviews')
  @UseGuards(SessionGuard, CsrfGuard)
  @ApiCookieAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Gửi đánh giá cho chuyến đi (Khách thuê hoặc Chủ xe)',
    description:
      'Chỉ gửi được sau khi chuyến đi đã COMPLETED. Điểm 1-5 sao, nhận xét tối đa 2.000 ký tự. Mỗi bên tham gia chỉ gửi đúng 1 đánh giá bất biến.',
  })
  @ApiResponse({
    status: 201,
    description: 'Gửi đánh giá thành công',
    type: ReviewResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Không phải người tham gia chuyến đi' })
  @ApiResponse({ status: 404, description: 'Chuyến đi không tồn tại' })
  @ApiResponse({ status: 409, description: 'Chuyến đi chưa COMPLETED hoặc đã đánh giá rồi' })
  async createReview(
    @CurrentUser('id') actorId: string,
    @Param('id', ParseUuidPipe) bookingId: string,
    @Body() dto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    return this.reviewsService.createReview(bookingId, actorId, dto);
  }

  @Get('bookings/:id/reviews')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Tra cứu danh sách đánh giá của chuyến đi',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách đánh giá',
    type: [ReviewResponseDto],
  })
  async getBookingReviews(
    @CurrentUser('id') actorId: string,
    @Param('id', ParseUuidPipe) bookingId: string,
  ): Promise<ReviewResponseDto[]> {
    return this.reviewsService.getBookingReviews(bookingId, actorId);
  }

  @Get('vehicles/:id/reviews')
  @ApiOperation({
    summary: 'Tra cứu danh sách và điểm đánh giá trung bình của xe (Công khai)',
    description: 'Tổng hợp điểm trung bình và các nhận xét từ khách thuê đã trải nghiệm xe.',
  })
  @ApiResponse({
    status: 200,
    description: 'Tổng hợp đánh giá xe',
    type: VehicleReviewsSummaryDto,
  })
  async getVehicleReviews(
    @Param('id', ParseUuidPipe) vehicleId: string,
  ): Promise<VehicleReviewsSummaryDto> {
    return this.reviewsService.getVehicleReviews(vehicleId);
  }
}
