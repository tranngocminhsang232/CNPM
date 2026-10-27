import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  UnprocessableEntityException,
  BadRequestException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { KeylessSimulatorAdapter } from './adapters/keyless-simulator.adapter';
import { TriggerKeylessDto } from './dto/trigger-keyless.dto';
import { KeylessOperationResponseDto } from './dto/keyless-operation-response.dto';
import {
  BookingStatus,
  InspectionType,
  KeylessAction,
  KeylessOperation,
  KeylessOperationStatus,
} from '@prisma/client';

export function computeKeylessHash(payload: {
  bookingId: string;
  actorId: string;
  action: KeylessAction;
}): string {
  const canonical = JSON.stringify({
    action: payload.action,
    actorId: payload.actorId.toLowerCase(),
    bookingId: payload.bookingId.toLowerCase(),
  });
  return createHash('sha256').update(canonical).digest('hex');
}

@Injectable()
export class KeylessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly simulator: KeylessSimulatorAdapter,
  ) {}

  /**
   * Kích hoạt thao tác điều khiển khóa ảo Keyless (UNLOCK / LOCK)
   */
  async triggerOperation(
    bookingId: string,
    actorId: string,
    dto: TriggerKeylessDto,
    idempotencyKey?: string,
  ): Promise<KeylessOperationResponseDto> {
    // 1. Kiểm tra header Idempotency-Key
    if (
      !idempotencyKey ||
      typeof idempotencyKey !== 'string' ||
      idempotencyKey.trim().length < 16 ||
      idempotencyKey.trim().length > 128
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Header Idempotency-Key là bắt buộc và phải có độ dài từ 16 đến 128 ký tự',
      });
    }

    const cleanKey = idempotencyKey.trim();
    if (!/^[a-zA-Z0-9_-]+$/.test(cleanKey)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Header Idempotency-Key chỉ được chứa các ký tự an toàn [a-zA-Z0-9_-]',
      });
    }

    // 2. Tính toán request hash chống replay payload lệch
    const requestHash = computeKeylessHash({
      bookingId,
      actorId,
      action: dto.action,
    });

    // 3. Kiểm tra idempotency record đã tồn tại
    const existingOp = await this.prisma.keylessOperation.findFirst({
      where: {
        actorId,
        bookingId,
        idempotencyKey: cleanKey,
      },
      include: {
        booking: { select: { status: true } },
      },
    });

    if (existingOp) {
      if (existingOp.requestHash !== requestHash) {
        throw new ConflictException({
          code: 'IDEMPOTENCY_MISMATCH',
          message:
            'Header Idempotency-Key đã được sử dụng trước đó với nội dung thao tác khác (IDEMPOTENCY_MISMATCH)',
        });
      }
      return this.mapToResponse(existingOp, existingOp.booking.status, true);
    }

    // 4. Kiểm tra thông tin chuyến đi booking
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        vehicle: true,
        inspections: true,
      },
    });

    if (!booking) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Chuyến đi không tồn tại',
      });
    }

    // BR-09 Rule 1: Actor phải là người thuê (Renter)
    if (booking.renterId !== actorId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Chỉ người thuê của chuyến đi mới có quyền điều khiển khóa xe',
      });
    }

    // BR-09 Rule 2: Xe phải hỗ trợ Keyless
    if (!booking.vehicle.keylessSupported) {
      throw new UnprocessableEntityException({
        code: 'KEYLESS_NOT_SUPPORTED',
        message: 'Xe này không hỗ trợ tính năng khóa ảo Keyless',
      });
    }

    // BR-09 Rule 3: Trạng thái booking phải là APPROVED hoặc IN_PROGRESS
    if (booking.status !== BookingStatus.APPROVED && booking.status !== BookingStatus.IN_PROGRESS) {
      throw new ConflictException({
        code: 'INVALID_BOOKING_STATUS',
        message: `Trạng thái chuyến đi hiện tại (${booking.status}) không cho phép điều khiển khóa xe`,
      });
    }

    // BR-09 Rule 4: Khung giờ thuê hợp lệ (cho phép sớm tối đa 15 phút trước startAt)
    const now = new Date();
    const earlyPickupBufferMs = 15 * 60 * 1000;
    const earliestAllowed = new Date(booking.startAt.getTime() - earlyPickupBufferMs);

    if (now < earliestAllowed || now >= booking.endAt) {
      throw new UnprocessableEntityException({
        code: 'OUTSIDE_RENTAL_PERIOD',
        message:
          'Chỉ có thể điều khiển xe trong khung giờ thuê (cho phép sớm tối đa 15 phút trước giờ nhận xe)',
      });
    }

    // BR-09 Rule 5: Với hành động UNLOCK khi xe ở trạng thái APPROVED, bắt buộc phải chốt biên bản CHECK_IN
    if (dto.action === KeylessAction.UNLOCK && booking.status === BookingStatus.APPROVED) {
      const checkInInspection = booking.inspections.find((i) => i.type === InspectionType.CHECK_IN);

      if (!checkInInspection || !checkInInspection.acknowledged || !checkInInspection.finalizedAt) {
        throw new UnprocessableEntityException({
          code: 'CHECKLIST_INCOMPLETE',
          message:
            'Cần hoàn thành và chốt biên bản kiểm tra nhận xe (CHECK_IN) trước khi mở khóa xe',
        });
      }
    }

    // BR-09 Rule 6: Kiểm tra không có thao tác PENDING hoặc UNKNOWN nào đang dở dang
    const unresolvedOp = await this.prisma.keylessOperation.findFirst({
      where: {
        bookingId,
        status: { in: [KeylessOperationStatus.PENDING, KeylessOperationStatus.UNKNOWN] },
      },
    });

    if (unresolvedOp) {
      throw new ConflictException({
        code: 'UNRESOLVED_OPERATION',
        message:
          'Đang có một thao tác điều khiển khóa xe chưa hoàn tất (PENDING/UNKNOWN), vui lòng chờ phản hồi từ xe hoặc thực hiện đối soát',
      });
    }

    // 5. Tạo bản ghi KeylessOperation ở trạng thái PENDING
    let createdOp: KeylessOperation;
    try {
      createdOp = await this.prisma.keylessOperation.create({
        data: {
          bookingId,
          actorId,
          action: dto.action,
          idempotencyKey: cleanKey,
          requestHash,
          status: KeylessOperationStatus.PENDING,
          provider: 'SIMULATOR',
        },
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new ConflictException({
          code: 'UNRESOLVED_OPERATION',
          message:
            'Đang có một thao tác điều khiển khóa xe chưa hoàn tất, vui lòng chờ trong giây lát',
        });
      }
      throw err;
    }

    // 6. Gửi lệnh tới KeylessSimulatorAdapter
    const simResult = await this.simulator.executeCommand(
      dto.action,
      booking.vehicle.plateNormalized,
      dto.simulateResult,
    );

    // 7. Cập nhật kết quả lệnh và chuyển trạng thái chuyến đi nếu mở khóa thành công
    let currentBookingStatus = booking.status;

    await this.prisma.$transaction(async (tx) => {
      // Cập nhật KeylessOperation
      await tx.keylessOperation.update({
        where: { id: createdOp.id },
        data: {
          status: simResult.status,
          deviceResult: simResult.deviceResult,
          resolvedAt: new Date(),
        },
      });

      // Nếu mở khóa thành công từ APPROVED -> chuyển sang IN_PROGRESS
      if (
        simResult.status === KeylessOperationStatus.SUCCESS &&
        dto.action === KeylessAction.UNLOCK &&
        booking.status === BookingStatus.APPROVED
      ) {
        await tx.booking.update({
          where: { id: bookingId },
          data: {
            status: BookingStatus.IN_PROGRESS,
            version: { increment: 1 },
          },
        });

        currentBookingStatus = BookingStatus.IN_PROGRESS;

        // Ghi nhận sự kiện vòng đời chuyến đi
        const event = await tx.bookingEvent.create({
          data: {
            bookingId,
            actorId,
            eventType: 'TRIP_STARTED',
            fromStatus: BookingStatus.APPROVED,
            toStatus: BookingStatus.IN_PROGRESS,
            reason:
              'Chuyến đi đã bắt đầu: Khách thuê đã mở khóa xe thành công qua chìa khóa ảo Keyless',
          },
        });

        // Gửi thông báo tới chủ xe
        await tx.notification.create({
          data: {
            userId: booking.ownerId,
            bookingId,
            eventId: event.id,
            type: 'TRIP_STARTED',
          },
        });
      }
    });

    const finalizedOp = await this.prisma.keylessOperation.findUniqueOrThrow({
      where: { id: createdOp.id },
    });

    return this.mapToResponse(finalizedOp, currentBookingStatus, false);
  }

  /**
   * Lấy chi tiết trạng thái của một lệnh điều khiển
   */
  async getOperation(
    bookingId: string,
    operationId: string,
    actorId: string,
  ): Promise<KeylessOperationResponseDto> {
    const op = await this.prisma.keylessOperation.findUnique({
      where: { id: operationId },
      include: {
        booking: {
          select: { renterId: true, ownerId: true, status: true },
        },
      },
    });

    if (!op || op.bookingId !== bookingId) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Lệnh điều khiển xe không tồn tại',
      });
    }

    if (op.booking.renterId !== actorId && op.booking.ownerId !== actorId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Bạn không có quyền truy cập thông tin lệnh điều khiển này',
      });
    }

    return this.mapToResponse(op, op.booking.status, false);
  }

  /**
   * Đối soát trạng thái lệnh UNKNOWN / PENDING
   */
  async reconcileOperation(
    bookingId: string,
    operationId: string,
    actorId: string,
  ): Promise<KeylessOperationResponseDto> {
    const op = await this.prisma.keylessOperation.findUnique({
      where: { id: operationId },
      include: {
        booking: {
          include: { vehicle: true },
        },
      },
    });

    if (!op || op.bookingId !== bookingId) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Lệnh điều khiển xe không tồn tại',
      });
    }

    if (op.booking.renterId !== actorId && op.booking.ownerId !== actorId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Bạn không có quyền đối soát lệnh điều khiển này',
      });
    }

    // Nếu đã hoàn tất (SUCCESS hoặc FAILED), trả về nguyên trạng
    if (
      op.status === KeylessOperationStatus.SUCCESS ||
      op.status === KeylessOperationStatus.FAILED
    ) {
      return this.mapToResponse(op, op.booking.status, false);
    }

    // Thực hiện đối soát qua simulator adapter
    const recResult = await this.simulator.reconcileCommand(
      op.action,
      op.booking.vehicle.plateNormalized,
    );

    let updatedBookingStatus = op.booking.status;

    await this.prisma.$transaction(async (tx) => {
      await tx.keylessOperation.update({
        where: { id: operationId },
        data: {
          status: recResult.status,
          deviceResult: recResult.deviceResult,
          resolvedAt: new Date(),
        },
      });

      if (
        recResult.status === KeylessOperationStatus.SUCCESS &&
        op.action === KeylessAction.UNLOCK &&
        op.booking.status === BookingStatus.APPROVED
      ) {
        await tx.booking.update({
          where: { id: bookingId },
          data: {
            status: BookingStatus.IN_PROGRESS,
            version: { increment: 1 },
          },
        });

        updatedBookingStatus = BookingStatus.IN_PROGRESS;

        const event = await tx.bookingEvent.create({
          data: {
            bookingId,
            actorId,
            eventType: 'TRIP_STARTED',
            fromStatus: BookingStatus.APPROVED,
            toStatus: BookingStatus.IN_PROGRESS,
            reason: 'Chuyến đi bắt đầu sau khi đối soát thành công lệnh mở khóa Keyless',
          },
        });

        await tx.notification.create({
          data: {
            userId: op.booking.ownerId,
            bookingId,
            eventId: event.id,
            type: 'TRIP_STARTED',
          },
        });
      }
    });

    const refreshedOp = await this.prisma.keylessOperation.findUniqueOrThrow({
      where: { id: operationId },
    });

    return this.mapToResponse(refreshedOp, updatedBookingStatus, false);
  }

  private mapToResponse(
    op: KeylessOperation,
    bookingStatus?: BookingStatus,
    isReplay = false,
  ): KeylessOperationResponseDto {
    return {
      id: op.id,
      bookingId: op.bookingId,
      actorId: op.actorId,
      action: op.action,
      idempotencyKey: op.idempotencyKey,
      status: op.status,
      provider: op.provider,
      deviceResult: op.deviceResult,
      resolvedAt: op.resolvedAt,
      createdAt: op.createdAt,
      bookingStatus,
      isReplay,
    };
  }
}
