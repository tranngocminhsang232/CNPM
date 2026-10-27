import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryVehiclesDto, VehicleSortOption } from './dto/query-vehicles.dto';
import { VehicleOptionsDto } from './dto/vehicle-options.dto';
import { VehicleSummaryDto, PaginationMetaDto } from './dto/vehicle-summary.dto';
import { VehicleDetailDto } from './dto/vehicle-detail.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  getVehicleOptions(): VehicleOptionsDto {
    return {
      cities: ['TP. Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng'],
      carTypes: ['SEDAN', 'SUV', 'HATCHBACK', 'MPV', 'CROSSOVER'],
      transmissions: ['AUTO', 'MANUAL'],
      amenities: [
        { code: 'GPS', name: 'Định vị GPS' },
        { code: 'BLUETOOTH', name: 'Kết nối Bluetooth' },
        { code: 'BACKUP_CAMERA', name: 'Camera lùi' },
        { code: 'SUNROOF', name: 'Cửa sổ trời' },
        { code: 'DASH_CAM', name: 'Camera hành trình' },
        { code: 'ETC', name: 'Thu phí tự động ETC' },
      ],
    };
  }

  async getVehicles(
    query: QueryVehiclesDto,
  ): Promise<{ data: VehicleSummaryDto[]; meta: PaginationMetaDto }> {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 10));
    const skip = (page - 1) * pageSize;

    // Validate date range pair
    if ((query.startAt && !query.endAt) || (!query.startAt && query.endAt)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'startAt và endAt phải được cung cấp cùng nhau',
      });
    }

    let queryStart: Date | undefined;
    let queryEnd: Date | undefined;

    if (query.startAt && query.endAt) {
      queryStart = new Date(query.startAt);
      queryEnd = new Date(query.endAt);

      if (isNaN(queryStart.getTime()) || isNaN(queryEnd.getTime())) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Định dạng ngày không hợp lệ (yêu cầu chuẩn ISO 8601)',
        });
      }

      if (queryEnd <= queryStart) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'endAt phải lớn hơn startAt',
        });
      }
    }

    const now = new Date();

    // Construct Prisma WhereInput
    const where: Prisma.VehicleWhereInput = {
      status: 'PUBLISHED', // Strictly PUBLISHED vehicles only
    };

    if (query.q) {
      const term = query.q.trim();
      where.OR = [
        { brand: { contains: term, mode: 'insensitive' } },
        { model: { contains: term, mode: 'insensitive' } },
      ];
    }

    if (query.brand) {
      where.brand = { equals: query.brand.trim(), mode: 'insensitive' };
    }

    if (query.city) {
      where.city = { equals: query.city.trim(), mode: 'insensitive' };
    }

    if (query.carType) {
      where.carType = query.carType;
    }

    if (query.transmission) {
      where.transmission = query.transmission;
    }

    if (query.seats) {
      where.seats = { gte: Number(query.seats) };
    }

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.pricePerDayVnd = {};
      if (query.minPrice !== undefined) {
        where.pricePerDayVnd.gte = BigInt(query.minPrice);
      }
      if (query.maxPrice !== undefined) {
        where.pricePerDayVnd.lte = BigInt(query.maxPrice);
      }
    }

    if (query.keylessOnly) {
      where.keylessSupported = true;
    }

    if (query.amenities && query.amenities.length > 0) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        ...query.amenities.map((code) => ({
          amenities: {
            some: {
              amenityCode: code.toUpperCase(),
            },
          },
        })),
      ];
    }

    // Rule: Exclude vehicles that have an overdue IN_PROGRESS trip (endAt < now)
    where.bookings = {
      none: {
        status: 'IN_PROGRESS',
        endAt: { lt: now },
      },
    };

    // Rule: Calendar overlap exclusion when dates are provided
    if (queryStart && queryEnd) {
      where.calendar = {
        none: {
          releasedAt: null,
          startAt: { lt: queryEnd },
          endAt: { gt: queryStart },
          OR: [
            { kind: 'OWNER_BLOCK' },
            {
              booking: {
                status: { not: 'REQUESTED' },
              },
            },
            {
              booking: {
                status: 'REQUESTED',
                requestExpiresAt: { gt: now },
              },
            },
          ],
        },
      };
    }

    // Determine Sort Order
    const orderBy: Prisma.VehicleOrderByWithRelationInput[] = [];
    switch (query.sort) {
      case VehicleSortOption.PRICE_ASC:
        orderBy.push({ pricePerDayVnd: 'asc' }, { id: 'asc' });
        break;
      case VehicleSortOption.PRICE_DESC:
        orderBy.push({ pricePerDayVnd: 'desc' }, { id: 'asc' });
        break;
      case VehicleSortOption.POPULARITY_DESC:
        orderBy.push({ bookings: { _count: 'desc' } }, { id: 'asc' });
        break;
      case VehicleSortOption.RATING_DESC:
        orderBy.push({ bookings: { _count: 'desc' } }, { createdAt: 'desc' }, { id: 'asc' });
        break;
      case VehicleSortOption.NEWEST:
      default:
        orderBy.push({ createdAt: 'desc' }, { id: 'asc' });
        break;
    }

    // Query Total & Paginated Items
    const [total, vehicles] = await Promise.all([
      this.prisma.vehicle.count({ where }),
      this.prisma.vehicle.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        include: {
          amenities: true,
          photos: {
            include: { media: true },
            orderBy: { position: 'asc' },
          },
          bookings: {
            where: { status: 'COMPLETED' },
            include: { reviews: true },
          },
        },
      }),
    ]);

    // Map each vehicle to public VehicleSummaryDto (Strict privacy: NO plate, NO pickupAddress)
    const data: VehicleSummaryDto[] = vehicles.map((v) => {
      // Extract verified cover image
      let coverImageUrl: string | null = null;
      const firstPhoto = v.photos[0];
      if (firstPhoto && firstPhoto.media && firstPhoto.media.state === 'VERIFIED') {
        const media = firstPhoto.media;
        const key = media.finalKey || media.stagingKey;
        coverImageUrl = `http://localhost:4000/api/v1/media/${key}`;
      }

      // Calculate rating average and review count
      const reviews = v.bookings.flatMap((b) => b.reviews);
      const reviewCount = reviews.length;
      const ratingAverage =
        reviewCount > 0
          ? Number((reviews.reduce((acc, r) => acc + r.score, 0) / reviewCount).toFixed(1))
          : 5.0;

      // Calculate optional quote if dates are specified
      let quote: VehicleSummaryDto['quote'] = undefined;
      if (queryStart && queryEnd) {
        const diffMs = queryEnd.getTime() - queryStart.getTime();
        const rentalDays = Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
        const priceNum = Number(v.pricePerDayVnd);
        const subtotalVnd = rentalDays * priceNum;
        quote = {
          rentalDays,
          subtotalVnd,
          totalVnd: subtotalVnd,
        };
      }

      return {
        id: v.id,
        brand: v.brand,
        model: v.model,
        year: v.year,
        city: v.city,
        carType: v.carType,
        transmission: v.transmission,
        seats: v.seats,
        amenities: v.amenities.map((a) => a.amenityCode),
        keylessSupported: v.keylessSupported,
        pricePerDayVnd: Number(v.pricePerDayVnd),
        coverImageUrl,
        ratingAverage,
        reviewCount,
        quote,
      };
    });

    const totalPages = Math.ceil(total / pageSize) || 1;

    return {
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages,
      },
    };
  }

  async getVehicleById(id: string): Promise<VehicleDetailDto> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        id,
        status: 'PUBLISHED',
      },
      include: {
        owner: true,
        amenities: true,
        photos: {
          include: { media: true },
          orderBy: { position: 'asc' },
        },
        bookings: {
          include: { reviews: true },
        },
      },
    });

    if (!vehicle) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Không tìm thấy xe hoặc xe chưa được công khai',
      });
    }

    // Photo URLs from verified media
    const photoUrls: string[] = vehicle.photos
      .filter((p) => p.media && p.media.state === 'VERIFIED')
      .map((p) => {
        const key = p.media.finalKey || p.media.stagingKey;
        return `http://localhost:4000/api/v1/media/${key}`;
      });

    const completedBookings = vehicle.bookings.filter((b) => b.status === 'COMPLETED');
    const reviews = completedBookings.flatMap((b) => b.reviews);
    const reviewCount = reviews.length;
    const ratingAverage =
      reviewCount > 0
        ? Number((reviews.reduce((acc, r) => acc + r.score, 0) / reviewCount).toFixed(1))
        : 5.0;

    return {
      id: vehicle.id,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      city: vehicle.city,
      carType: vehicle.carType,
      transmission: vehicle.transmission,
      seats: vehicle.seats,
      description: vehicle.description,
      amenities: vehicle.amenities.map((a) => a.amenityCode),
      photoUrls,
      keylessSupported: vehicle.keylessSupported,
      pricePerDayVnd: Number(vehicle.pricePerDayVnd),
      ratingAverage,
      reviewCount,
      totalTrips: completedBookings.length,
      owner: {
        id: vehicle.owner.id,
        name: vehicle.owner.name,
        joinedAt: vehicle.owner.createdAt.toISOString(),
      },
    };
  }
}
