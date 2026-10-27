import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { SessionGuard } from '../auth/guards/session.guard';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InspectionsService } from './inspections.service';
import { SaveInspectionDto } from './dto/save-inspection.dto';
import { InspectionResponseDto } from './dto/inspection-response.dto';
import { InspectionType } from '@prisma/client';

@ApiTags('Inspections')
@Controller('bookings/:id/inspections')
export class InspectionsController {
  constructor(private readonly inspectionsService: InspectionsService) {}

  @Put()
  @UseGuards(SessionGuard, CsrfGuard)
  @ApiOperation({
    summary: 'Lưu hoặc cập nhật bản nháp biên bản bàn giao xe (CHECK_IN / CHECK_OUT)',
    description:
      'Ghi nhận số km, mức pin/xăng, ghi chú vết xước và danh sách ảnh chụp 4 góc xe. Áp dụng optimistic locking qua trường version.',
  })
  @ApiParam({ name: 'id', description: 'ID chuyến đi booking', format: 'uuid' })
  @ApiResponse({ status: 200, type: InspectionResponseDto, description: 'Lưu biên bản thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ hoặc ảnh chưa verified' })
  @ApiResponse({ status: 403, description: 'Không có quyền thao tác trên booking này' })
  @ApiResponse({ status: 404, description: 'Chuyến đi không tồn tại' })
  @ApiResponse({ status: 409, description: 'Biên bản đã chốt hoặc xung đột phiên bản version' })
  async saveInspection(
    @Param('id') bookingId: string,
    @CurrentUser('id') actorId: string,
    @Body() dto: SaveInspectionDto,
  ): Promise<InspectionResponseDto> {
    return this.inspectionsService.saveInspection(bookingId, actorId, dto);
  }

  @Post(':type/finalize')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard, CsrfGuard)
  @ApiOperation({
    summary: 'Ký duyệt và chốt biên bản bàn giao bất biến',
    description:
      'Yêu cầu bắt buộc phải có đầy đủ 4 góc ảnh xe (FRONT, REAR, LEFT, RIGHT). Khi hoàn tất, ghi nhận sự kiện hệ thống và gửi thông báo cho đối tác.',
  })
  @ApiParam({ name: 'id', description: 'ID chuyến đi booking', format: 'uuid' })
  @ApiParam({
    name: 'type',
    enum: InspectionType,
    description: 'Loại biên bản: CHECK_IN hoặc CHECK_OUT',
  })
  @ApiResponse({
    status: 200,
    type: InspectionResponseDto,
    description: 'Chốt biên bản thành công',
  })
  @ApiResponse({ status: 403, description: 'Không có quyền thao tác' })
  @ApiResponse({ status: 404, description: 'Biên bản chưa được tạo' })
  @ApiResponse({ status: 422, description: 'Thiếu góc ảnh bắt buộc trong 4 góc' })
  async finalizeInspection(
    @Param('id') bookingId: string,
    @Param('type') type: InspectionType,
    @CurrentUser('id') actorId: string,
  ): Promise<InspectionResponseDto> {
    return this.inspectionsService.finalizeInspection(bookingId, actorId, type);
  }

  @Get()
  @UseGuards(SessionGuard)
  @ApiOperation({
    summary: 'Tra cứu danh sách biên bản kiểm tra của chuyến đi',
    description:
      'Chỉ người thuê hoặc chủ xe của đơn mới có quyền truy cập. Kèm presigned read URL cho các ảnh.',
  })
  @ApiParam({ name: 'id', description: 'ID chuyến đi booking', format: 'uuid' })
  @ApiResponse({ status: 200, type: [InspectionResponseDto], description: 'Danh sách biên bản' })
  async getInspections(
    @Param('id') bookingId: string,
    @CurrentUser('id') actorId: string,
  ): Promise<InspectionResponseDto[]> {
    return this.inspectionsService.getInspections(bookingId, actorId);
  }

  @Get(':type')
  @UseGuards(SessionGuard)
  @ApiOperation({
    summary: 'Tra cứu biên bản kiểm tra theo loại (CHECK_IN hoặc CHECK_OUT)',
  })
  @ApiParam({ name: 'id', description: 'ID chuyến đi booking', format: 'uuid' })
  @ApiParam({
    name: 'type',
    enum: InspectionType,
    description: 'Loại biên bản: CHECK_IN hoặc CHECK_OUT',
  })
  @ApiResponse({ status: 200, type: InspectionResponseDto, description: 'Chi tiết biên bản' })
  @ApiResponse({ status: 404, description: 'Biên bản chưa được tạo' })
  async getInspectionByType(
    @Param('id') bookingId: string,
    @Param('type') type: InspectionType,
    @CurrentUser('id') actorId: string,
  ): Promise<InspectionResponseDto> {
    return this.inspectionsService.getInspectionByType(bookingId, type, actorId);
  }
}
