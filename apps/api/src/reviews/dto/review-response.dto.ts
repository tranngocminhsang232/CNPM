import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewUserSummaryDto {
  @ApiProperty({ description: 'ID người dùng' })
  id!: string;

  @ApiProperty({ description: 'Họ tên hiển thị' })
  name!: string;
}

export class ReviewResponseDto {
  @ApiProperty({ description: 'ID đánh giá' })
  id!: string;

  @ApiProperty({ description: 'ID chuyến đi' })
  bookingId!: string;

  @ApiProperty({ description: 'ID người viết đánh giá' })
  authorId!: string;

  @ApiProperty({ description: 'ID người nhận đánh giá' })
  targetUserId!: string;

  @ApiProperty({ description: 'Điểm số từ 1 đến 5', example: 5 })
  score!: number;

  @ApiProperty({ description: 'Nội dung nhận xét' })
  comment!: string;

  @ApiProperty({ description: 'Thời điểm tạo đánh giá' })
  createdAt!: string;

  @ApiPropertyOptional({ description: 'Thông tin người viết' })
  author?: ReviewUserSummaryDto;

  @ApiPropertyOptional({ description: 'Thông tin người nhận' })
  targetUser?: ReviewUserSummaryDto;
}

export class VehicleReviewsSummaryDto {
  @ApiProperty({
    description: 'Điểm đánh giá trung bình (làm tròn 1 chữ số thập phân)',
    example: 4.8,
  })
  averageScore!: number;

  @ApiProperty({ description: 'Tổng số lượt đánh giá', example: 12 })
  totalReviews!: number;

  @ApiProperty({ description: 'Danh sách đánh giá', type: [ReviewResponseDto] })
  reviews!: ReviewResponseDto[];
}
