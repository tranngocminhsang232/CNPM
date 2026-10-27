import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiExtraModels } from '@nestjs/swagger';
import { PricingService } from './pricing.service';
import { CalculatePricingDto, PricingPreviewQueryDto } from './dto/calculate-pricing.dto';
import { QuoteDto, PricingBreakdownDto } from './dto/quote.dto';
import { ParseUuidPipe } from '../common';

@ApiTags('Pricing')
@ApiExtraModels(QuoteDto, PricingBreakdownDto)
@Controller()
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Post('pricing/quote')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({
    summary: 'Tính báo giá thuê xe theo khoảng ngày, gói bảo hiểm và kiểm tra lịch xe khả dụng',
  })
  @ApiResponse({
    status: 200,
    description: 'Báo giá chi tiết với đầy đủ bóc tách chi phí',
    type: QuoteDto,
  })
  @ApiResponse({ status: 400, description: 'Dữ liệu đầu vào hoặc định dạng ngày không hợp lệ' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy xe' })
  @ApiResponse({ status: 422, description: 'Thời lượng thuê không hợp lệ' })
  async getQuote(@Body() dto: CalculatePricingDto): Promise<{ data: QuoteDto }> {
    const quote = await this.pricingService.calculateQuote(dto);
    return { data: quote };
  }

  @Post('pricing/calculate')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({
    summary: 'Tính toán biểu phí thuê xe chi tiết (alias cho POST /pricing/quote)',
  })
  @ApiResponse({
    status: 200,
    description: 'Biểu phí tính toán thành công',
    type: QuoteDto,
  })
  async calculatePricing(@Body() dto: CalculatePricingDto): Promise<{ data: QuoteDto }> {
    const quote = await this.pricingService.calculateQuote(dto);
    return { data: quote };
  }

  @Get('vehicles/:id/pricing-preview')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({
    summary: 'Xem trước dự toán chi phí thuê xe bằng phương thức GET (hỗ trợ UI widget)',
  })
  @ApiResponse({
    status: 200,
    description: 'Dự toán chi phí thuê xe',
    type: QuoteDto,
  })
  @ApiResponse({ status: 400, description: 'Khoảng ngày không hợp lệ' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy xe' })
  async getPricingPreview(
    @Param('id', new ParseUuidPipe()) vehicleId: string,
    @Query() query: PricingPreviewQueryDto,
  ): Promise<{ data: QuoteDto }> {
    const quote = await this.pricingService.calculateQuote({
      vehicleId,
      startAt: query.startAt,
      endAt: query.endAt,
      insurancePackage: query.insurancePackage,
      voucherCode: query.voucherCode,
    });
    return { data: quote };
  }
}
