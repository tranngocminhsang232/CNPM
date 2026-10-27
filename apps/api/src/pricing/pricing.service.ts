import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CalculatePricingDto, InsurancePackageTier } from './dto/calculate-pricing.dto';
import { QuoteDto } from './dto/quote.dto';

const PRICING_VERSION = 'daily-v1';
const MIN_RENTAL_HOURS = 1;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async calculateQuote(dto: CalculatePricingDto): Promise<QuoteDto> {
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

    // 1. Fetch Vehicle
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: dto.vehicleId },
    });

    if (!vehicle || vehicle.status !== 'PUBLISHED') {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Không tìm thấy xe hoặc xe chưa được công khai trên hệ thống',
      });
    }

    // 2. Calculate Rental Days (round up to 24h blocks)
    const rentalDays = Math.max(1, Math.ceil(durationMs / DAY_MS));
    const pricePerDayVnd = Number(vehicle.pricePerDayVnd);
    const baseRentVnd = pricePerDayVnd * rentalDays;

    // 3. Peak/Weekend Surcharge (Saturday and Sunday)
    let weekendDays = 0;
    const current = new Date(start);
    while (current < end) {
      const day = current.getUTCDay();
      if (day === 0 || day === 6) {
        weekendDays++;
      }
      current.setUTCDate(current.getUTCDate() + 1);
    }
    const peakSurchargeVnd = Math.round(weekendDays * (pricePerDayVnd * 0.1));

    // 4. Insurance Fee
    let insuranceDaily = 0;
    if (dto.insurancePackage === InsurancePackageTier.PREMIUM) {
      insuranceDaily = 200000;
    } else if (dto.insurancePackage === InsurancePackageTier.STANDARD) {
      insuranceDaily = 100000;
    }
    const insuranceFeeVnd = insuranceDaily * rentalDays;

    // 5. Discount (Default 0 in baseline G2-02; connected in G2-03)
    const discountVnd = 0;

    // 6. Subtotal
    const subtotalVnd = Math.max(0, baseRentVnd + peakSurchargeVnd + insuranceFeeVnd - discountVnd);

    // 7. Platform Service Fee (10% of baseRent + peakSurcharge)
    const serviceFeeVnd = Math.round((baseRentVnd + peakSurchargeVnd) * 0.1);

    // 8. Deposit based on daily price tier
    let depositVnd = 5000000;
    if (pricePerDayVnd > 2000000) {
      depositVnd = 15000000;
    } else if (pricePerDayVnd > 1000000) {
      depositVnd = 10000000;
    }

    // 9. Total (Strict mathematical integrity: total = subtotal + serviceFee + deposit)
    const totalVnd = subtotalVnd + serviceFeeVnd + depositVnd;

    // 10. Check Calendar Availability
    const now = new Date();
    const conflict = await this.prisma.vehicleCalendar.findFirst({
      where: {
        vehicleId: vehicle.id,
        releasedAt: null,
        startAt: { lt: end },
        endAt: { gt: start },
        OR: [
          { kind: 'OWNER_BLOCK' },
          { booking: { status: { not: 'REQUESTED' } } },
          { booking: { status: 'REQUESTED', requestExpiresAt: { gt: now } } },
        ],
      },
    });

    const available = !conflict;
    const unavailableReason = conflict
      ? 'Xe đã có lịch đặt hoặc chủ xe bận trong khoảng thời gian này'
      : undefined;

    return {
      vehicleId: vehicle.id,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      pricePerDayVnd,
      rentalDays,
      subtotalVnd,
      serviceFeeVnd,
      depositVnd,
      totalVnd,
      pricingVersion: PRICING_VERSION,
      available,
      unavailableReason,
      breakdown: {
        rentalDays,
        pricePerDayVnd,
        baseRentVnd,
        peakSurchargeVnd,
        insuranceFeeVnd,
        discountVnd,
        subtotalVnd,
        serviceFeeVnd,
        depositVnd,
        totalVnd,
      },
    };
  }
}
