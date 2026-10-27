import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MediaState, Prisma, VehicleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateVehicleDto,
  normalizePlate,
  OwnerVehicleDto,
  UpdateVehicleDto,
} from './dto/owner-vehicle.dto';

@Injectable()
export class OwnerVehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  async createVehicle(ownerId: string, dto: CreateVehicleDto): Promise<OwnerVehicleDto> {
    const plateNormalized = normalizePlate(dto.licensePlate);

    const existing = await this.prisma.vehicle.findUnique({
      where: { plateNormalized },
    });

    if (existing) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: `Biển số xe ${dto.licensePlate} (${plateNormalized}) đã được đăng ký trong hệ thống`,
      });
    }

    if (dto.photoMediaIds && dto.photoMediaIds.length > 0) {
      const verifiedMedia = await this.prisma.mediaObject.findMany({
        where: {
          id: { in: dto.photoMediaIds },
          state: MediaState.VERIFIED,
        },
      });

      if (verifiedMedia.length !== dto.photoMediaIds.length) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Một hoặc nhiều ảnh xe chưa hoàn tất xác thực (VERIFIED)',
        });
      }
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.create({
        data: {
          ownerId,
          brand: dto.brand.trim(),
          model: dto.model.trim(),
          year: dto.year,
          plateNormalized,
          city: dto.city,
          pickupAddress: dto.pickupAddress.trim(),
          carType: dto.carType,
          transmission: dto.transmission,
          seats: dto.seats,
          description: dto.description.trim(),
          pricePerDayVnd: BigInt(dto.pricePerDayVnd),
          keylessSupported: dto.keylessSupported ?? false,
          status: VehicleStatus.DRAFT,
          version: 1,
        },
      });

      if (dto.amenities && dto.amenities.length > 0) {
        const uniqueAmenities = Array.from(new Set(dto.amenities));
        await tx.vehicleAmenity.createMany({
          data: uniqueAmenities.map((code) => ({
            vehicleId: vehicle.id,
            amenityCode: code,
          })),
        });
      }

      if (dto.photoMediaIds && dto.photoMediaIds.length > 0) {
        await tx.vehiclePhoto.createMany({
          data: dto.photoMediaIds.map((mediaId, position) => ({
            vehicleId: vehicle.id,
            mediaId,
            position,
          })),
        });

        await tx.mediaObject.updateMany({
          where: { id: { in: dto.photoMediaIds } },
          data: { vehicleId: vehicle.id },
        });
      }

      return tx.vehicle.findUniqueOrThrow({
        where: { id: vehicle.id },
        include: {
          amenities: true,
          photos: { orderBy: { position: 'asc' } },
        },
      });
    });

    return this.mapToDto(created);
  }

  async getOwnerVehicles(ownerId: string): Promise<OwnerVehicleDto[]> {
    const vehicles = await this.prisma.vehicle.findMany({
      where: { ownerId },
      include: {
        amenities: true,
        photos: { orderBy: { position: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return vehicles.map((v) => this.mapToDto(v));
  }

  async getOwnerVehicleById(vehicleId: string, ownerId: string): Promise<OwnerVehicleDto> {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        amenities: true,
        photos: { orderBy: { position: 'asc' } },
      },
    });

    if (!vehicle) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Không tìm thấy xe với ID: ${vehicleId}`,
      });
    }

    if (vehicle.ownerId !== ownerId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Bạn không có quyền quản trị chiếc xe này',
      });
    }

    return this.mapToDto(vehicle);
  }

  async updateVehicle(
    vehicleId: string,
    ownerId: string,
    dto: UpdateVehicleDto,
  ): Promise<OwnerVehicleDto> {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Không tìm thấy xe với ID: ${vehicleId}`,
      });
    }

    if (vehicle.ownerId !== ownerId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Bạn không có quyền quản trị chiếc xe này',
      });
    }

    if (dto.photoMediaIds && dto.photoMediaIds.length > 0) {
      const verifiedMedia = await this.prisma.mediaObject.findMany({
        where: {
          id: { in: dto.photoMediaIds },
          state: MediaState.VERIFIED,
        },
      });

      if (verifiedMedia.length !== dto.photoMediaIds.length) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Một hoặc nhiều ảnh xe chưa hoàn tất xác thực (VERIFIED)',
        });
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const dataToUpdate: Prisma.VehicleUpdateInput = {
        version: { increment: 1 },
      };

      if (dto.brand !== undefined) dataToUpdate.brand = dto.brand.trim();
      if (dto.model !== undefined) dataToUpdate.model = dto.model.trim();
      if (dto.year !== undefined) dataToUpdate.year = dto.year;
      if (dto.city !== undefined) dataToUpdate.city = dto.city;
      if (dto.pickupAddress !== undefined) dataToUpdate.pickupAddress = dto.pickupAddress.trim();
      if (dto.carType !== undefined) dataToUpdate.carType = dto.carType;
      if (dto.transmission !== undefined) dataToUpdate.transmission = dto.transmission;
      if (dto.seats !== undefined) dataToUpdate.seats = dto.seats;
      if (dto.description !== undefined) dataToUpdate.description = dto.description.trim();
      if (dto.pricePerDayVnd !== undefined)
        dataToUpdate.pricePerDayVnd = BigInt(dto.pricePerDayVnd);
      if (dto.keylessSupported !== undefined) dataToUpdate.keylessSupported = dto.keylessSupported;

      await tx.vehicle.update({
        where: { id: vehicleId },
        data: dataToUpdate,
      });

      if (dto.amenities !== undefined) {
        await tx.vehicleAmenity.deleteMany({ where: { vehicleId } });
        if (dto.amenities.length > 0) {
          const uniqueAmenities = Array.from(new Set(dto.amenities));
          await tx.vehicleAmenity.createMany({
            data: uniqueAmenities.map((code) => ({
              vehicleId,
              amenityCode: code,
            })),
          });
        }
      }

      if (dto.photoMediaIds !== undefined) {
        await tx.vehiclePhoto.deleteMany({ where: { vehicleId } });
        if (dto.photoMediaIds.length > 0) {
          await tx.vehiclePhoto.createMany({
            data: dto.photoMediaIds.map((mediaId, position) => ({
              vehicleId,
              mediaId,
              position,
            })),
          });

          await tx.mediaObject.updateMany({
            where: { id: { in: dto.photoMediaIds } },
            data: { vehicleId },
          });
        }
      }

      return tx.vehicle.findUniqueOrThrow({
        where: { id: vehicleId },
        include: {
          amenities: true,
          photos: { orderBy: { position: 'asc' } },
        },
      });
    });

    return this.mapToDto(updated);
  }

  async publishVehicle(vehicleId: string, ownerId: string): Promise<OwnerVehicleDto> {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        photos: true,
      },
    });

    if (!vehicle) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Không tìm thấy xe với ID: ${vehicleId}`,
      });
    }

    if (vehicle.ownerId !== ownerId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Bạn không có quyền quản trị chiếc xe này',
      });
    }

    if (vehicle.status === VehicleStatus.PUBLISHED) {
      return this.getOwnerVehicleById(vehicleId, ownerId);
    }

    if (vehicle.photos.length < 1) {
      throw new UnprocessableEntityException({
        code: 'PUBLISH_REQUIREMENTS_NOT_MET',
        message: 'Xe phải có ít nhất 1 hình ảnh trước khi đăng công khai',
      });
    }

    const updated = await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        status: VehicleStatus.PUBLISHED,
        version: { increment: 1 },
      },
      include: {
        amenities: true,
        photos: { orderBy: { position: 'asc' } },
      },
    });

    return this.mapToDto(updated);
  }

  private mapToDto(vehicle: {
    id: string;
    ownerId: string;
    brand: string;
    model: string;
    year: number;
    plateNormalized: string;
    city: string;
    pickupAddress: string;
    carType: any;
    transmission: any;
    seats: number;
    description: string;
    pricePerDayVnd: bigint;
    keylessSupported: boolean;
    status: VehicleStatus;
    version: number;
    createdAt: Date;
    updatedAt: Date;
    amenities?: { amenityCode: string }[];
    photos?: { mediaId: string; position: number }[];
  }): OwnerVehicleDto {
    return {
      id: vehicle.id,
      ownerId: vehicle.ownerId,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      plateNormalized: vehicle.plateNormalized,
      city: vehicle.city,
      pickupAddress: vehicle.pickupAddress,
      carType: vehicle.carType,
      transmission: vehicle.transmission,
      seats: vehicle.seats,
      description: vehicle.description,
      pricePerDayVnd: Number(vehicle.pricePerDayVnd),
      keylessSupported: vehicle.keylessSupported,
      status: vehicle.status,
      version: vehicle.version,
      amenities: (vehicle.amenities || []).map((a) => a.amenityCode),
      photos: (vehicle.photos || []).map((p) => ({
        mediaId: p.mediaId,
        position: p.position,
      })),
      createdAt: vehicle.createdAt.toISOString(),
      updatedAt: vehicle.updatedAt.toISOString(),
    };
  }
}
