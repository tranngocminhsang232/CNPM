import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { PaymentWebhookDto, SimulatePaymentDto } from './dto/payment-webhook.dto';
import { SessionGuard } from '../auth/guards/session.guard';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PublicCsrf } from '../auth/decorators/public-csrf.decorator';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-intent')
  @UseGuards(SessionGuard, CsrfGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Tạo ý định thanh toán (tiền cọc giữ chỗ hoặc toàn bộ)',
    description:
      'Tạo phiên thanh toán sandbox với chữ ký số HMAC-SHA512. Chỉ khách thuê mới có quyền thanh toán cho đơn của mình.',
  })
  @ApiResponse({
    status: 201,
    description: 'Tạo ý định thanh toán thành công, trả về redirect URL',
    type: PaymentResponseDto,
  })
  async createPaymentIntent(
    @CurrentUser('id') actorId: string,
    @Body() dto: CreatePaymentIntentDto,
  ): Promise<PaymentResponseDto> {
    return this.paymentsService.createPaymentIntent(actorId, dto);
  }

  @Post('webhook')
  @PublicCsrf()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'IPN / Webhook từ cổng thanh toán (Xác thực chữ ký HMAC-SHA512)',
    description:
      'Nhận thông báo trạng thái giao dịch từ đối tác thanh toán, đối soát chữ ký số và cập nhật sự kiện cho chuyến đi.',
  })
  @ApiResponse({
    status: 200,
    description: 'Xử lý webhook thành công',
    type: PaymentResponseDto,
  })
  async processWebhook(@Body() dto: PaymentWebhookDto): Promise<PaymentResponseDto> {
    return this.paymentsService.processWebhook(dto);
  }

  @Post('simulate')
  @PublicCsrf()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Giả lập thanh toán sandbox (Hỗ trợ demo & testing)',
    description:
      'Tự động sinh chữ ký HMAC-SHA512 hợp lệ để giả lập giao dịch thành công hoặc thất bại trong môi trường phát triển.',
  })
  @ApiResponse({
    status: 200,
    description: 'Giả lập thanh toán thành công',
    type: PaymentResponseDto,
  })
  async simulatePayment(@Body() dto: SimulatePaymentDto): Promise<PaymentResponseDto> {
    return this.paymentsService.simulatePayment(dto);
  }

  @Get(':ref')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Tra cứu trạng thái giao dịch theo transactionRef',
  })
  @ApiResponse({
    status: 200,
    description: 'Chi tiết thông tin giao dịch thanh toán',
    type: PaymentResponseDto,
  })
  async getPaymentByRef(
    @CurrentUser('id') actorId: string,
    @Param('ref') ref: string,
  ): Promise<PaymentResponseDto> {
    return this.paymentsService.getPaymentByRef(ref, actorId);
  }
}
