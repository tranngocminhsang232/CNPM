import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ValidatePromotionDto, ValidatedPromotionDto } from './dto/validate-promotion.dto';

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  async validatePromotion(
    codeOrDto: string | ValidatePromotionDto,
    providedSubtotalVnd?: number,
  ): Promise<ValidatedPromotionDto> {
    const code = (typeof codeOrDto === 'string' ? codeOrDto : codeOrDto.code).trim().toUpperCase();

    const subtotalVnd =
      typeof codeOrDto === 'string' ? (providedSubtotalVnd ?? 0) : codeOrDto.subtotalVnd;

    const promotion = await this.prisma.promotion.findUnique({
      where: { code },
    });

    if (!promotion) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Mã khuyến mãi không tồn tại hoặc đã bị xóa',
      });
    }

    if (!promotion.isActive) {
      throw new BadRequestException({
        code: 'INACTIVE_PROMOTION',
        message: 'Mã khuyến mãi hiện đang tạm dừng hoạt động',
      });
    }

    const now = new Date();
    if (now < promotion.validFrom || now > promotion.validUntil) {
      throw new BadRequestException({
        code: 'EXPIRED_PROMOTION',
        message: 'Mã khuyến mãi đã hết hạn hoặc chưa đến ngày bắt đầu áp dụng',
      });
    }

    if (promotion.usedCount >= promotion.maxUsage) {
      throw new BadRequestException({
        code: 'PROMOTION_USAGE_EXCEEDED',
        message: 'Mã khuyến mãi đã hết lượt sử dụng',
      });
    }

    const minOrder = Number(promotion.minOrderValueVnd);
    if (subtotalVnd < minOrder) {
      throw new BadRequestException({
        code: 'MINIMUM_ORDER_NOT_MET',
        message: `Đơn hàng tối thiểu để áp dụng mã là ${minOrder.toLocaleString('vi-VN')} VND (hiện tại: ${subtotalVnd.toLocaleString('vi-VN')} VND)`,
      });
    }

    let calculatedDiscount = 0;
    if (promotion.discountType === 'PERCENTAGE') {
      const percent = Number(promotion.discountValue);
      calculatedDiscount = Math.round(subtotalVnd * (percent / 100));
      if (promotion.maxDiscountVnd !== null) {
        calculatedDiscount = Math.min(calculatedDiscount, Number(promotion.maxDiscountVnd));
      }
    } else {
      calculatedDiscount = Number(promotion.discountValue);
    }

    const discountVnd = Math.max(0, Math.min(calculatedDiscount, subtotalVnd));
    const subtotalAfterDiscountVnd = Math.max(0, subtotalVnd - discountVnd);

    return {
      code: promotion.code,
      description: promotion.description,
      discountType: promotion.discountType,
      discountValue: Number(promotion.discountValue),
      maxDiscountVnd: promotion.maxDiscountVnd !== null ? Number(promotion.maxDiscountVnd) : null,
      minOrderValueVnd: minOrder,
      discountVnd,
      subtotalBeforeDiscountVnd: subtotalVnd,
      subtotalAfterDiscountVnd,
      valid: true,
    };
  }
}
