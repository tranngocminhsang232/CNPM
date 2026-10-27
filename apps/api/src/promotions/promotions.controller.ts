import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ValidatePromotionDto, ValidatedPromotionDto } from './dto/validate-promotion.dto';
import { PromotionsService } from './promotions.service';

@ApiTags('promotions')
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Kiểm tra tính hợp lệ và mức giảm giá của voucher khuyến mãi',
    description:
      'Kiểm tra mã khuyến mãi theo giá trị đơn hàng, hạn sử dụng, số lượt dùng và tính mức chiết khấu VND chính xác.',
  })
  @ApiResponse({
    status: 200,
    description: 'Mã khuyến mãi hợp lệ, trả về số tiền được giảm',
    type: ValidatedPromotionDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Mã khuyến mãi không hợp lệ, hết hạn, hết lượt dùng hoặc chưa đạt đơn hàng tối thiểu',
  })
  @ApiResponse({
    status: 404,
    description: 'Mã khuyến mãi không tồn tại',
  })
  async validatePromotion(@Body() dto: ValidatePromotionDto): Promise<ValidatedPromotionDto> {
    return this.promotionsService.validatePromotion(dto);
  }
}
