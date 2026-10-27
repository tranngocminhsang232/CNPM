import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { QueryBookingsDto, BookingPerspective } from './dto/query-bookings.dto';
import { BookingResponseDto } from './dto/booking-response.dto';

const PRICING_VERSION = 'daily-v1';
const MIN_RENTAL_HOURS = 1;
const HOUR_MS = 60 * 60 * 1000;
const REQUEST_EXPIRY_MINUTES = 15;

export function computeBookingHash(payload: {
  vehicleId: string;
  startAt: string;
  endAt: string;
  expectedTotalVnd: number | bigint;
  pricingVersion: string;
}): string {
  const canonical = JSON.stringify({
    endAt: new Date(payload.endAt).toISOString(),
    expectedTotalVnd: Number(payload.expectedTotalVnd),
    pricingVersion: payload.pricingVersion,
    startAt: new Date(payload.startAt).toISOString(),
    vehicleId: payload.vehicleId.toLowerCase(),
  });
  return createHash('sha256').update(canonical).digest('hex');
}

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: PricingService,
  ) {}

  async createBooking(
    actorId: string,
    idempotencyKey: string,
    dto: CreateBookingDto,
  ): Promise<{ isReplay: boolean; booking: BookingResponseDto }> {
    // 1. Validate Idempotency-Key header
    if (
      !idempotencyKey ||
      typeof idempotencyKey !== 'string' ||
      idempotencyKey.length < 16 ||
      idempotencyKey.length > 128
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Header Idempotency-Key bắt buộc có độ dài từ 16 đến 128 ký tự',
      });
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(idempotencyKey)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Header Idempotency-Key chỉ được chứa ký tự chữ, số, gạch ngang và gạch dưới',
      });
    }

    // 2. Compute canonical hash
    const pricingVersion = dto.pricingVersion || PRICING_VERSION;
    const requestHash = computeBookingHash({
      vehicleId: dto.vehicleId,
      startAt: dto.startAt,
      endAt: dto.endAt,
      expectedTotalVnd: dto.expectedTotalVnd,
      pricingVersion,
    });

    // 3. Check for existing idempotency record (replay)
    const existingRecord = await this.prisma.idempotencyRecord.findUnique({
      where: {
        actorId_operation_key: {
          actorId,
          operation: 'CREATE_BOOKING',
          key: idempotencyKey,
        },
      },
      include: {
        booking: {
          include: {
            pricingSnapshot: true,
            vehicle: true,
            renter: { select: { id: true, name: true, phone: true } },
            owner: { select: { id: true, name: true, phone: true } },
          },
        },
      },
    });

    if (existingRecord) {
      if (existingRecord.requestHash === requestHash) {
        return {
          isReplay: true,
          booking: this.formatBookingResponse(existingRecord.booking, actorId),
        };
      } else {
        throw new ConflictException({
          code: 'IDEMPOTENCY_MISMATCH',
          message: 'Idempotency-Key này đã được sử dụng với thông tin đặt xe khác',
        });
      }
    }

    // 4. Validate Dates
    const start = new Date(dto.startAt);
    const end = new Date(dto.endAt);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Định dạng ngày không hợp lệ (yêu cầu chuẩn ISO 8601)',
      });
    }

    if (end <= start) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Thời điểm kết thúc (endAt) phải lớn hơn thời điểm bắt đầu (startAt)',
      });
    }

    const durationMs = end.getTime() - start.getTime();
    if (durationMs < MIN_RENTAL_HOURS * HOUR_MS) {
      throw new UnprocessableEntityException({
        code: 'INVALID_RENTAL_PERIOD',
        message: `Thời lượng thuê xe tối thiểu là ${MIN_RENTAL_HOURS} giờ`,
      });
    }

    // 5. Fetch vehicle & check self-booking
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: dto.vehicleId },
    });

    if (!vehicle || vehicle.status !== 'PUBLISHED') {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Không tìm thấy xe hoặc xe chưa được công khai trên hệ thống',
      });
    }

    if (vehicle.ownerId === actorId) {
      throw new ForbiddenException({
        code: 'SELF_BOOKING_FORBIDDEN',
        message: 'Chủ xe không thể tự thuê xe của chính mình',
      });
    }

    // 6. Recalculate quote and check price freshness & calendar availability
    const quote = await this.pricingService.calculateQuote({
      vehicleId: dto.vehicleId,
      startAt: dto.startAt,
      endAt: dto.endAt,
      insurancePackage: dto.insurancePackage,
      voucherCode: dto.voucherCode,
    });

    if (!quote.available) {
      throw new ConflictException({
        code: 'VEHICLE_UNAVAILABLE',
        message: quote.unavailableReason || 'Xe không khả dụng trong khung giờ được yêu cầu',
      });
    }

    if (Number(quote.totalVnd) !== Number(dto.expectedTotalVnd)) {
      throw new ConflictException({
        code: 'PRICE_CHANGED',
        message: `Biểu phí đã thay đổi: Tổng tiền tính lại là ${quote.totalVnd.toLocaleString('vi-VN')} VND (khác ${dto.expectedTotalVnd.toLocaleString('vi-VN')} VND dự kiến)`,
        details: { quote },
      });
    }

    // 7. Atomic transaction for Booking creation
    try {
      const createdBooking = await this.prisma.$transaction(async (tx) => {
        // a. Create booking
        const booking = await tx.booking.create({
          data: {
            vehicleId: vehicle.id,
            renterId: actorId,
            ownerId: vehicle.ownerId,
            startAt: start,
            endAt: end,
            status: 'REQUESTED',
            requestExpiresAt: new Date(Date.now() + REQUEST_EXPIRY_MINUTES * 60 * 1000),
          },
        });

        // b. Create pricing snapshot
        await tx.pricingSnapshot.create({
          data: {
            bookingId: booking.id,
            currency: 'VND',
            pricePerDayVnd: BigInt(quote.pricePerDayVnd),
            rentalDays: quote.rentalDays,
            subtotalVnd: BigInt(quote.subtotalVnd),
            serviceFeeVnd: BigInt(quote.serviceFeeVnd),
            depositVnd: BigInt(quote.depositVnd),
            totalVnd: BigInt(quote.totalVnd),
            pricingVersion,
          },
        });

        // c. Hold calendar (GiST exclusion will trigger if concurrent overlap occurs)
        await tx.vehicleCalendar.create({
          data: {
            vehicleId: vehicle.id,
            bookingId: booking.id,
            kind: 'BOOKING',
            startAt: start,
            endAt: end,
          },
        });

        // d. Record voucher usage if applicable
        if (dto.voucherCode) {
          const promo = await tx.promotion.findUnique({
            where: { code: dto.voucherCode.trim().toUpperCase() },
          });
          if (promo) {
            await tx.promotionUsage.create({
              data: {
                promotionId: promo.id,
                userId: actorId,
                bookingId: booking.id,
                discountVnd: BigInt(quote.breakdown?.discountVnd || 0),
              },
            });

            await tx.promotion.update({
              where: { id: promo.id },
              data: { usedCount: { increment: 1 } },
            });
          }
        }

        // e. Create idempotency record
        await tx.idempotencyRecord.create({
          data: {
            actorId,
            operation: 'CREATE_BOOKING',
            key: idempotencyKey,
            requestHash,
            bookingId: booking.id,
          },
        });

        // f. Create booking event
        const event = await tx.bookingEvent.create({
          data: {
            bookingId: booking.id,
            actorId,
            eventType: 'BOOKING_REQUESTED',
            fromStatus: null,
            toStatus: 'REQUESTED',
            reason: 'Yêu cầu đặt xe mới được gửi từ khách thuê',
          },
        });

        // g. Create notification for owner
        await tx.notification.create({
          data: {
            userId: vehicle.ownerId,
            bookingId: booking.id,
            eventId: event.id,
            type: 'BOOKING_REQUESTED',
          },
        });

        return booking;
      });

      // Fetch complete booking record
      const fullBooking = await this.prisma.booking.findUniqueOrThrow({
        where: { id: createdBooking.id },
        include: {
          pricingSnapshot: true,
          vehicle: true,
          renter: { select: { id: true, name: true, phone: true } },
          owner: { select: { id: true, name: true, phone: true } },
        },
      });

      return {
        isReplay: false,
        booking: this.formatBookingResponse(fullBooking, actorId),
      };
    } catch (error: any) {
      if (
        error?.code === 'P2002' ||
        error?.code === '23P01' ||
        error?.message?.includes('vehicle_calendar') ||
        error?.message?.includes('exclusion')
      ) {
        throw new ConflictException({
          code: 'VEHICLE_UNAVAILABLE',
          message: 'Xe đã có lịch được giữ hoặc chủ xe bận trong khung giờ này',
        });
      }
      if (error?.message?.includes('bookings_renter_not_owner')) {
        throw new ForbiddenException({
          code: 'SELF_BOOKING_FORBIDDEN',
          message: 'Chủ xe không thể tự thuê xe của chính mình',
        });
      }
      throw error;
    }
  }

  async getBookings(
    actorId: string,
    query: QueryBookingsDto,
  ): Promise<{
    data: BookingResponseDto[];
    meta: { page: number; pageSize: number; total: number; totalPages: number };
  }> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 10;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (query.perspective === BookingPerspective.OWNER) {
      where.ownerId = actorId;
    } else {
      where.renterId = actorId;
    }

    if (query.status) {
      where.status = query.status;
    }

    const [total, items] = await Promise.all([
      this.prisma.booking.count({ where }),
      this.prisma.booking.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          pricingSnapshot: true,
          vehicle: true,
          renter: { select: { id: true, name: true, phone: true } },
          owner: { select: { id: true, name: true, phone: true } },
        },
      }),
    ]);

    return {
      data: items.map((b) => this.formatBookingResponse(b, actorId)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    };
  }

  async getBookingById(bookingId: string, actorId: string): Promise<BookingResponseDto> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        pricingSnapshot: true,
        vehicle: true,
        renter: { select: { id: true, name: true, phone: true } },
        owner: { select: { id: true, name: true, phone: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Không tìm thấy đơn đặt xe',
      });
    }

    if (booking.renterId !== actorId && booking.ownerId !== actorId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Bạn không có quyền truy cập thông tin đơn đặt xe này',
      });
    }

    return this.formatBookingResponse(booking, actorId);
  }

  async approveBooking(bookingId: string, actorId: string): Promise<BookingResponseDto> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Không tìm thấy đơn đặt xe',
      });
    }

    if (booking.ownerId !== actorId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Chỉ chủ xe mới có quyền phê duyệt đơn thuê này',
      });
    }

    if (booking.status !== 'REQUESTED') {
      throw new ConflictException({
        code: 'INVALID_TRANSITION',
        message: `Không thể duyệt đơn đang ở trạng thái ${booking.status}. Chỉ duyệt được khi ở trạng thái REQUESTED.`,
      });
    }

    return await this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id: bookingId, version: booking.version },
        data: {
          status: 'APPROVED',
          version: { increment: 1 },
        },
        include: {
          pricingSnapshot: true,
          vehicle: true,
          renter: { select: { id: true, name: true, phone: true } },
          owner: { select: { id: true, name: true, phone: true } },
        },
      });

      const event = await tx.bookingEvent.create({
        data: {
          bookingId,
          actorId,
          eventType: 'BOOKING_APPROVED',
          fromStatus: 'REQUESTED',
          toStatus: 'APPROVED',
          reason: 'Chủ xe đã phê duyệt yêu cầu đặt xe',
        },
      });

      await tx.notification.create({
        data: {
          userId: booking.renterId,
          bookingId,
          eventId: event.id,
          type: 'BOOKING_APPROVED',
        },
      });

      return this.formatBookingResponse(updated, actorId);
    });
  }

  async rejectBooking(
    bookingId: string,
    actorId: string,
    reason: string,
  ): Promise<BookingResponseDto> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Không tìm thấy đơn đặt xe',
      });
    }

    if (booking.ownerId !== actorId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Chỉ chủ xe mới có quyền từ chối đơn thuê này',
      });
    }

    if (booking.status !== 'REQUESTED') {
      throw new ConflictException({
        code: 'INVALID_TRANSITION',
        message: `Không thể từ chối đơn đang ở trạng thái ${booking.status}. Chỉ từ chối được khi ở trạng thái REQUESTED.`,
      });
    }

    return await this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id: bookingId, version: booking.version },
        data: {
          status: 'REJECTED',
          reason,
          version: { increment: 1 },
        },
        include: {
          pricingSnapshot: true,
          vehicle: true,
          renter: { select: { id: true, name: true, phone: true } },
          owner: { select: { id: true, name: true, phone: true } },
        },
      });

      // Release calendar hold
      await tx.vehicleCalendar.updateMany({
        where: { bookingId, releasedAt: null },
        data: { releasedAt: new Date() },
      });

      // Reverse promotion usage if any
      const usage = await tx.promotionUsage.findFirst({
        where: { bookingId },
      });
      if (usage) {
        await tx.promotion.update({
          where: { id: usage.promotionId },
          data: { usedCount: { decrement: 1 } },
        });
        await tx.promotionUsage.delete({
          where: { id: usage.id },
        });
      }

      const event = await tx.bookingEvent.create({
        data: {
          bookingId,
          actorId,
          eventType: 'BOOKING_REJECTED',
          fromStatus: 'REQUESTED',
          toStatus: 'REJECTED',
          reason,
        },
      });

      await tx.notification.create({
        data: {
          userId: booking.renterId,
          bookingId,
          eventId: event.id,
          type: 'BOOKING_REJECTED',
        },
      });

      return this.formatBookingResponse(updated, actorId);
    });
  }

  async cancelBooking(
    bookingId: string,
    actorId: string,
    reason: string,
  ): Promise<BookingResponseDto> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Không tìm thấy đơn đặt xe',
      });
    }

    if (booking.renterId !== actorId && booking.ownerId !== actorId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Bạn không có quyền hủy đơn đặt xe này',
      });
    }

    if (booking.status !== 'REQUESTED' && booking.status !== 'APPROVED') {
      throw new ConflictException({
        code: 'INVALID_TRANSITION',
        message: `Không thể hủy đơn đang ở trạng thái ${booking.status}. Chỉ có thể hủy đơn khi ở trạng thái REQUESTED hoặc APPROVED.`,
      });
    }

    return await this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id: bookingId, version: booking.version },
        data: {
          status: 'CANCELLED',
          reason,
          version: { increment: 1 },
        },
        include: {
          pricingSnapshot: true,
          vehicle: true,
          renter: { select: { id: true, name: true, phone: true } },
          owner: { select: { id: true, name: true, phone: true } },
        },
      });

      // Release calendar hold
      await tx.vehicleCalendar.updateMany({
        where: { bookingId, releasedAt: null },
        data: { releasedAt: new Date() },
      });

      // Reverse promotion usage if any
      const usage = await tx.promotionUsage.findFirst({
        where: { bookingId },
      });
      if (usage) {
        await tx.promotion.update({
          where: { id: usage.promotionId },
          data: { usedCount: { decrement: 1 } },
        });
        await tx.promotionUsage.delete({
          where: { id: usage.id },
        });
      }

      const event = await tx.bookingEvent.create({
        data: {
          bookingId,
          actorId,
          eventType: 'BOOKING_CANCELLED',
          fromStatus: booking.status,
          toStatus: 'CANCELLED',
          reason,
        },
      });

      // Notify the other party
      const recipientId = actorId === booking.renterId ? booking.ownerId : booking.renterId;
      await tx.notification.create({
        data: {
          userId: recipientId,
          bookingId,
          eventId: event.id,
          type: 'BOOKING_CANCELLED',
        },
      });

      return this.formatBookingResponse(updated, actorId);
    });
  }

  private formatBookingResponse(booking: any, actorId?: string): BookingResponseDto {
    const isOwner = actorId ? booking.ownerId === actorId : false;
    const isApprovedOrBeyond = ['APPROVED', 'IN_PROGRESS', 'COMPLETED'].includes(booking.status);
    const canSeePrivate = isOwner || isApprovedOrBeyond;

    return {
      id: booking.id,
      vehicleId: booking.vehicleId,
      renterId: booking.renterId,
      ownerId: booking.ownerId,
      startAt: booking.startAt instanceof Date ? booking.startAt.toISOString() : booking.startAt,
      endAt: booking.endAt instanceof Date ? booking.endAt.toISOString() : booking.endAt,
      status: booking.status,
      requestExpiresAt:
        booking.requestExpiresAt instanceof Date
          ? booking.requestExpiresAt.toISOString()
          : booking.requestExpiresAt,
      completedAt: booking.completedAt
        ? booking.completedAt instanceof Date
          ? booking.completedAt.toISOString()
          : booking.completedAt
        : null,
      reason: booking.reason || null,
      version: booking.version,
      createdAt:
        booking.createdAt instanceof Date ? booking.createdAt.toISOString() : booking.createdAt,
      vehicle: booking.vehicle
        ? {
            id: booking.vehicle.id,
            brand: booking.vehicle.brand,
            model: booking.vehicle.model,
            year: booking.vehicle.year,
            city: booking.vehicle.city,
            pricePerDayVnd: Number(booking.vehicle.pricePerDayVnd),
            keylessSupported: booking.vehicle.keylessSupported,
            plateNormalized: canSeePrivate ? booking.vehicle.plateNormalized : null,
            pickupAddress: canSeePrivate ? booking.vehicle.pickupAddress : null,
          }
        : undefined,
      pricingSnapshot: booking.pricingSnapshot
        ? {
            currency: booking.pricingSnapshot.currency,
            pricePerDayVnd: Number(booking.pricingSnapshot.pricePerDayVnd),
            rentalDays: booking.pricingSnapshot.rentalDays,
            subtotalVnd: Number(booking.pricingSnapshot.subtotalVnd),
            serviceFeeVnd: Number(booking.pricingSnapshot.serviceFeeVnd),
            depositVnd: Number(booking.pricingSnapshot.depositVnd),
            totalVnd: Number(booking.pricingSnapshot.totalVnd),
            pricingVersion: booking.pricingSnapshot.pricingVersion,
          }
        : null,
      renter: booking.renter
        ? {
            id: booking.renter.id,
            name: booking.renter.name,
            phone: booking.renter.phone,
          }
        : undefined,
      owner: booking.owner
        ? {
            id: booking.owner.id,
            name: booking.owner.name,
            phone: booking.owner.phone,
          }
        : undefined,
    };
  }
}
