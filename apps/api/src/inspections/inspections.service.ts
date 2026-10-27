import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import {
  InspectionType,
  InspectionAngle,
  BookingStatus,
  MediaState,
  Inspection,
  InspectionPhoto,
} from '@prisma/client';
import { SaveInspectionDto } from './dto/save-inspection.dto';
import { InspectionResponseDto, InspectionPhotoDto } from './dto/inspection-response.dto';

type InspectionWithPhotos = Inspection & { photos: InspectionPhoto[] };

@Injectable()
export class InspectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
  ) {}

  async saveInspection(
    bookingId: string,
    actorId: string,
    dto: SaveInspectionDto,
  ): Promise<InspectionResponseDto> {
    // 1. Verify booking existence & permissions
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new NotFoundException('Không tìm thấy chuyến đi tương ứng');
    }

    if (booking.renterId !== actorId && booking.ownerId !== actorId) {
      throw new ForbiddenException('Bạn không có quyền thực hiện kiểm tra xe cho chuyến đi này');
    }

    // 2. Verify booking status
    if (dto.type === InspectionType.CHECK_IN) {
      if (
        booking.status !== BookingStatus.APPROVED &&
        booking.status !== BookingStatus.IN_PROGRESS
      ) {
        throw new BadRequestException(
          'Biên bản nhận xe chỉ có thể thực hiện khi đơn đã được duyệt hoặc đang diễn ra',
        );
      }
    } else if (dto.type === InspectionType.CHECK_OUT) {
      if (booking.status !== BookingStatus.IN_PROGRESS) {
        throw new BadRequestException(
          'Biên bản trả xe chỉ có thể thực hiện khi chuyến đi đang diễn ra',
        );
      }

      // BR-10: Kiểm tra số km ODO sau chuyến không nhỏ hơn trước chuyến
      const checkInInspection = await this.prisma.inspection.findUnique({
        where: { bookingId_type: { bookingId, type: InspectionType.CHECK_IN } },
      });

      if (checkInInspection && dto.odometerKm < checkInInspection.odometerKm) {
        throw new BadRequestException(
          `Số km lúc trả xe (${dto.odometerKm} km) không được nhỏ hơn số km lúc nhận xe (${checkInInspection.odometerKm} km)`,
        );
      }
    }

    // 3. Check existing inspection & optimistic locking
    const existing = await this.prisma.inspection.findUnique({
      where: { bookingId_type: { bookingId, type: dto.type } },
    });

    if (existing?.finalizedAt) {
      throw new ConflictException('Biên bản kiểm tra xe đã được chốt và không thể chỉnh sửa');
    }

    if (existing && dto.version !== undefined && dto.version !== existing.version) {
      throw new ConflictException(
        'Dữ liệu kiểm tra xe đã được thay đổi bởi phiên khác (Concurrency Conflict)',
      );
    }

    // 4. Verify media objects
    for (const photo of dto.photos) {
      const media = await this.prisma.mediaObject.findUnique({
        where: { id: photo.mediaId },
      });
      if (!media) {
        throw new BadRequestException(`Ảnh kiểm tra (mediaId: ${photo.mediaId}) không tồn tại`);
      }
      if (media.state !== MediaState.VERIFIED) {
        throw new BadRequestException(
          `Ảnh kiểm tra (mediaId: ${photo.mediaId}) chưa được xác thực trên lưu trữ`,
        );
      }
    }

    // 5. Atomic upsert
    const nextVersion = (existing?.version ?? 0) + 1;

    const saved = await this.prisma.$transaction(async (tx) => {
      const insp = await tx.inspection.upsert({
        where: { bookingId_type: { bookingId, type: dto.type } },
        update: {
          odometerKm: dto.odometerKm,
          fuelPercent: dto.fuelPercent,
          damageNotes: dto.damageNotes ?? null,
          performedBy: actorId,
          version: nextVersion,
        },
        create: {
          id: randomUUID(),
          bookingId,
          type: dto.type,
          odometerKm: dto.odometerKm,
          fuelPercent: dto.fuelPercent,
          damageNotes: dto.damageNotes ?? null,
          performedBy: actorId,
          version: nextVersion,
        },
      });

      // Update photos
      await tx.inspectionPhoto.deleteMany({
        where: { inspectionId: insp.id },
      });

      if (dto.photos.length > 0) {
        await tx.inspectionPhoto.createMany({
          data: dto.photos.map((p) => ({
            inspectionId: insp.id,
            angle: p.angle,
            mediaId: p.mediaId,
          })),
        });
      }

      return tx.inspection.findUniqueOrThrow({
        where: { id: insp.id },
        include: { photos: true },
      });
    });

    return this.mapInspectionToDto(saved, actorId);
  }

  async finalizeInspection(
    bookingId: string,
    actorId: string,
    type: InspectionType,
  ): Promise<InspectionResponseDto> {
    // 1. Verify booking & permissions
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new NotFoundException('Không tìm thấy chuyến đi tương ứng');
    }

    if (booking.renterId !== actorId && booking.ownerId !== actorId) {
      throw new ForbiddenException('Bạn không có quyền thực hiện kiểm tra xe cho chuyến đi này');
    }

    // 2. Fetch inspection
    const inspection = await this.prisma.inspection.findUnique({
      where: { bookingId_type: { bookingId, type } },
      include: { photos: true },
    });

    if (!inspection) {
      throw new NotFoundException(
        `Biên bản kiểm tra xe (${type}) chưa được khởi tạo. Vui lòng lưu thông tin trước khi hoàn tất.`,
      );
    }

    // Idempotent: if already finalized, return existing
    if (inspection.finalizedAt) {
      return this.mapInspectionToDto(inspection, actorId);
    }

    // 3. Mandatory check: Must have photos for all 4 angles FRONT, REAR, LEFT, RIGHT
    const requiredAngles = [
      InspectionAngle.FRONT,
      InspectionAngle.REAR,
      InspectionAngle.LEFT,
      InspectionAngle.RIGHT,
    ];
    const presentAngles = new Set(inspection.photos.map((p) => p.angle));
    const missingAngles = requiredAngles.filter((angle) => !presentAngles.has(angle));

    if (missingAngles.length > 0) {
      throw new UnprocessableEntityException(
        `Biên bản kiểm tra xe bắt buộc phải có đủ 4 góc ảnh. Còn thiếu các góc: ${missingAngles.join(', ')}`,
      );
    }

    // BR-10: Kiểm tra số km ODO sau chuyến không nhỏ hơn trước chuyến đối với CHECK_OUT
    if (type === InspectionType.CHECK_OUT) {
      const checkInInspection = await this.prisma.inspection.findUnique({
        where: { bookingId_type: { bookingId, type: InspectionType.CHECK_IN } },
      });

      if (checkInInspection && inspection.odometerKm < checkInInspection.odometerKm) {
        throw new UnprocessableEntityException(
          `Số km lúc trả xe (${inspection.odometerKm} km) không được nhỏ hơn số km lúc nhận xe (${checkInInspection.odometerKm} km)`,
        );
      }
    }

    // 4. Atomic finalize
    const finalized = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.inspection.update({
        where: { id: inspection.id },
        data: {
          finalizedAt: new Date(),
          acknowledged: true,
          version: inspection.version + 1,
        },
        include: { photos: true },
      });

      // Record event
      const event = await tx.bookingEvent.create({
        data: {
          id: randomUUID(),
          bookingId,
          actorId,
          eventType: `INSPECTION_${type}_FINALIZED`,
          fromStatus: booking.status,
          toStatus: booking.status,
          reason: `Hoàn tất biên bản kiểm tra xe (${type}): ${updated.odometerKm} km, pin/nhiên liệu ${updated.fuelPercent}%, ${updated.photos.length} ảnh`,
        },
      });

      // Send notification to counterparty
      const recipientId = actorId === booking.renterId ? booking.ownerId : booking.renterId;
      await tx.notification.create({
        data: {
          id: randomUUID(),
          userId: recipientId,
          bookingId,
          eventId: event.id,
          type: `INSPECTION_${type}_FINALIZED`,
        },
      });

      return updated;
    });

    return this.mapInspectionToDto(finalized, actorId);
  }

  async getInspections(bookingId: string, actorId: string): Promise<InspectionResponseDto[]> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new NotFoundException('Không tìm thấy chuyến đi tương ứng');
    }

    if (booking.renterId !== actorId && booking.ownerId !== actorId) {
      throw new ForbiddenException('Bạn không có quyền xem thông tin chuyến đi này');
    }

    const inspections = await this.prisma.inspection.findMany({
      where: { bookingId },
      include: { photos: true },
      orderBy: { createdAt: 'asc' },
    });

    return Promise.all(inspections.map((insp) => this.mapInspectionToDto(insp, actorId)));
  }

  async getInspectionByType(
    bookingId: string,
    type: InspectionType,
    actorId: string,
  ): Promise<InspectionResponseDto> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new NotFoundException('Không tìm thấy chuyến đi tương ứng');
    }

    if (booking.renterId !== actorId && booking.ownerId !== actorId) {
      throw new ForbiddenException('Bạn không có quyền xem thông tin chuyến đi này');
    }

    const inspection = await this.prisma.inspection.findUnique({
      where: { bookingId_type: { bookingId, type } },
      include: { photos: true },
    });

    if (!inspection) {
      throw new NotFoundException(`Biên bản kiểm tra xe (${type}) chưa được tạo`);
    }

    return this.mapInspectionToDto(inspection, actorId);
  }

  private async mapInspectionToDto(
    insp: InspectionWithPhotos,
    actorId: string,
  ): Promise<InspectionResponseDto> {
    const photosWithUrls: InspectionPhotoDto[] = await Promise.all(
      insp.photos.map(async (photo) => {
        let readUrl: string | undefined;
        try {
          const res = await this.mediaService.getReadUrl(photo.mediaId, actorId);
          readUrl = res.url;
        } catch {
          // If presigned URL fails, leave undefined
        }
        return {
          angle: photo.angle,
          mediaId: photo.mediaId,
          readUrl,
        };
      }),
    );

    return {
      id: insp.id,
      bookingId: insp.bookingId,
      type: insp.type,
      odometerKm: insp.odometerKm,
      fuelPercent: insp.fuelPercent,
      damageNotes: insp.damageNotes,
      acknowledged: insp.acknowledged,
      finalizedAt: insp.finalizedAt,
      version: insp.version,
      performedBy: insp.performedBy,
      createdAt: insp.createdAt,
      photos: photosWithUrls,
    };
  }
}
