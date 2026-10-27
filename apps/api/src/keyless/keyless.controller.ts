import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiHeader } from '@nestjs/swagger';
import { SessionGuard } from '../auth/guards/session.guard';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { KeylessService } from './keyless.service';
import { TriggerKeylessDto } from './dto/trigger-keyless.dto';
import { KeylessOperationResponseDto } from './dto/keyless-operation-response.dto';

@ApiTags('Keyless')
@Controller('bookings/:id/keyless-operations')
export class KeylessController {
  constructor(private readonly keylessService: KeylessService) {}

  @Post()
  @UseGuards(SessionGuard, CsrfGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Kích hoạt thao tác điều khiển khóa xe ảo Keyless (UNLOCK / LOCK)',
    description:
      'Gửi lệnh mở hoặc khóa xe qua kết nối viễn thông IoT. Yêu cầu Idempotency-Key bắt buộc, xác thực người thuê, xe hỗ trợ Keyless, khung giờ thuê hợp lệ và biên bản kiểm tra nhận xe CHECK_IN đã chốt.',
  })
  @ApiParam({ name: 'id', description: 'ID chuyến đi booking', format: 'uuid' })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Khóa chống lặp duy nhất cho mỗi thao tác người dùng (độ dài 16-128 ký tự)',
    required: true,
  })
  @ApiResponse({
    status: 200,
    type: KeylessOperationResponseDto,
    description: 'Lệnh điều khiển đã được xử lý thành công',
  })
  @ApiResponse({ status: 400, description: 'Thiếu Idempotency-Key hoặc dữ liệu không hợp lệ' })
  @ApiResponse({ status: 403, description: 'Không có quyền điều khiển xe (chỉ người thuê)' })
  @ApiResponse({ status: 404, description: 'Chuyến đi không tồn tại' })
  @ApiResponse({
    status: 409,
    description: 'Xung đột thao tác chưa hoàn tất (UNRESOLVED_OPERATION) hoặc lệch Idempotency-Key',
  })
  @ApiResponse({
    status: 422,
    description: 'Xe không hỗ trợ Keyless, ngoài giờ thuê, hoặc chưa chốt biên bản CHECK_IN',
  })
  async triggerOperation(
    @Param('id') bookingId: string,
    @CurrentUser('id') actorId: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: TriggerKeylessDto,
  ): Promise<KeylessOperationResponseDto> {
    return this.keylessService.triggerOperation(bookingId, actorId, dto, idempotencyKey);
  }

  @Get(':opId')
  @UseGuards(SessionGuard)
  @ApiOperation({
    summary: 'Tra cứu trạng thái của một lệnh điều khiển khóa xe',
    description: 'Chỉ khách thuê hoặc chủ xe của booking mới có quyền tra cứu.',
  })
  @ApiParam({ name: 'id', description: 'ID chuyến đi booking', format: 'uuid' })
  @ApiParam({ name: 'opId', description: 'ID lệnh điều khiển xe', format: 'uuid' })
  @ApiResponse({
    status: 200,
    type: KeylessOperationResponseDto,
    description: 'Thông tin chi tiết lệnh điều khiển',
  })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 404, description: 'Lệnh điều khiển không tồn tại' })
  async getOperation(
    @Param('id') bookingId: string,
    @Param('opId') operationId: string,
    @CurrentUser('id') actorId: string,
  ): Promise<KeylessOperationResponseDto> {
    return this.keylessService.getOperation(bookingId, operationId, actorId);
  }

  @Post(':opId/reconcile')
  @UseGuards(SessionGuard, CsrfGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đối soát trạng thái lệnh điều khiển bị mất kết nối (UNKNOWN hoặc PENDING)',
    description:
      'Gửi truy vấn kiểm tra tới bộ mô phỏng phần cứng để giải phóng lệnh bị treo và cập nhật trạng thái chuyến đi nếu cần.',
  })
  @ApiParam({ name: 'id', description: 'ID chuyến đi booking', format: 'uuid' })
  @ApiParam({ name: 'opId', description: 'ID lệnh điều khiển xe', format: 'uuid' })
  @ApiResponse({
    status: 200,
    type: KeylessOperationResponseDto,
    description: 'Lệnh điều khiển đã được đối soát thành công',
  })
  @ApiResponse({ status: 403, description: 'Không có quyền đối soát' })
  @ApiResponse({ status: 404, description: 'Lệnh điều khiển không tồn tại' })
  async reconcileOperation(
    @Param('id') bookingId: string,
    @Param('opId') operationId: string,
    @CurrentUser('id') actorId: string,
  ): Promise<KeylessOperationResponseDto> {
    return this.keylessService.reconcileOperation(bookingId, operationId, actorId);
  }
}
