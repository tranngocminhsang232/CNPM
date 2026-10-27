import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewResponseDto, VehicleReviewsSummaryDto } from './dto/review-response.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async createReview(
    bookingId: string,
    actorId: string,
    dto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        renter: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Không tìm thấy chuyến đi tương ứng để viết đánh giá',
      });
    }

    if (booking.renterId !== actorId && booking.ownerId !== actorId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Chỉ khách thuê hoặc chủ xe của chuyến đi mới có quyền viết đánh giá',
      });
    }

    if (booking.status !== 'COMPLETED') {
      throw new ConflictException({
        code: 'INVALID_BOOKING_STATUS',
        message: `Chỉ có thể viết đánh giá sau khi chuyến đi đã COMPLETED (trạng thái hiện tại: ${booking.status})`,
      });
    }

    // Determine target user (the other party)
    const targetUserId = actorId === booking.renterId ? booking.ownerId : booking.renterId;

    // Check if already reviewed (BR-12: exactly one review per participant per booking)
    const existingReview = await this.prisma.review.findUnique({
      where: {
        bookingId_authorId: {
          bookingId,
          authorId: actorId,
        },
      },
    });

    if (existingReview) {
      throw new ConflictException({
        code: 'ALREADY_REVIEWED',
        message:
          'Bạn đã gửi đánh giá cho chuyến đi này rồi. Đánh giá là bất biến và không thể sửa đổi.',
      });
    }

    return await this.prisma.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: {
          bookingId,
          authorId: actorId,
          targetUserId,
          score: dto.score,
          comment: dto.comment,
        },
        include: {
          author: { select: { id: true, name: true } },
          targetUser: { select: { id: true, name: true } },
        },
      });

      const event = await tx.bookingEvent.create({
        data: {
          bookingId,
          actorId,
          eventType: 'REVIEW_SUBMITTED',
          reason: `Đánh giá ${dto.score} sao: ${dto.comment.slice(0, 100)}`,
        },
      });

      await tx.notification.create({
        data: {
          userId: targetUserId,
          bookingId,
          eventId: event.id,
          type: 'REVIEW_RECEIVED',
        },
      });

      return this.formatReviewResponse(review);
    });
  }

  async getBookingReviews(bookingId: string, _actorId?: string): Promise<ReviewResponseDto[]> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Không tìm thấy chuyến đi tương ứng',
      });
    }

    const reviews = await this.prisma.review.findMany({
      where: { bookingId },
      include: {
        author: { select: { id: true, name: true } },
        targetUser: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reviews.map((r) => this.formatReviewResponse(r));
  }

  async getVehicleReviews(vehicleId: string): Promise<VehicleReviewsSummaryDto> {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Không tìm thấy xe tương ứng',
      });
    }

    // BR-12: Vehicle reviews are written by renters (authorId == booking.renterId)
    const reviews = await this.prisma.review.findMany({
      where: {
        booking: {
          vehicleId,
        },
      },
      include: {
        booking: { select: { renterId: true } },
        author: { select: { id: true, name: true } },
        targetUser: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filter to reviews where author is renter
    const renterReviews = reviews.filter((r) => r.authorId === r.booking.renterId);

    const totalReviews = renterReviews.length;
    let averageScore = 5.0;
    if (totalReviews > 0) {
      const sum = renterReviews.reduce((acc, r) => acc + r.score, 0);
      averageScore = Math.round((sum / totalReviews) * 10) / 10;
    }

    return {
      averageScore,
      totalReviews,
      reviews: renterReviews.map((r) => this.formatReviewResponse(r)),
    };
  }

  private formatReviewResponse(review: any): ReviewResponseDto {
    return {
      id: review.id,
      bookingId: review.bookingId,
      authorId: review.authorId,
      targetUserId: review.targetUserId,
      score: review.score,
      comment: review.comment,
      createdAt:
        review.createdAt instanceof Date ? review.createdAt.toISOString() : review.createdAt,
      author: review.author ? { id: review.author.id, name: review.author.name } : undefined,
      targetUser: review.targetUser
        ? { id: review.targetUser.id, name: review.targetUser.name }
        : undefined,
    };
  }
}
