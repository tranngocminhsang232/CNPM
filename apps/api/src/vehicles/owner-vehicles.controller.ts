import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { SessionGuard } from '../auth/guards/session.guard';
import { CreateVehicleDto, OwnerVehicleDto, UpdateVehicleDto } from './dto/owner-vehicle.dto';
import { OwnerVehiclesService } from './owner-vehicles.service';

@ApiTags('owner-vehicles')
@Controller('owner/vehicles')
export class OwnerVehiclesController {
  constructor(private readonly ownerVehiclesService: OwnerVehiclesService) {}

  @Post()
  @UseGuards(SessionGuard, CsrfGuard)
  @ApiCookieAuth('access_token')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chủ xe đăng ký tạo xe mới (trạng thái DRAFT)' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Tạo xe mới thành công với trạng thái DRAFT',
    type: OwnerVehicleDto,
  })
  @ApiBadRequestResponse({ description: 'Dữ liệu đầu vào không hợp lệ' })
  @ApiConflictResponse({ description: 'Biển số xe đã được đăng ký trên hệ thống' })
  async createVehicle(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateVehicleDto,
  ): Promise<OwnerVehicleDto> {
    return this.ownerVehiclesService.createVehicle(user.id, dto);
  }

  @Get()
  @UseGuards(SessionGuard)
  @ApiCookieAuth('access_token')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách toàn bộ xe thuộc sở hữu của chủ xe hiện tại' })
  @ApiOkResponse({
    description: 'Danh sách xe cá nhân của chủ xe',
    type: [OwnerVehicleDto],
  })
  async getOwnerVehicles(@CurrentUser() user: AuthenticatedUser): Promise<OwnerVehicleDto[]> {
    return this.ownerVehiclesService.getOwnerVehicles(user.id);
  }

  @Get(':id')
  @UseGuards(SessionGuard)
  @ApiCookieAuth('access_token')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xem chi tiết quản lý một xe của chủ xe' })
  @ApiOkResponse({
    description: 'Chi tiết thông tin xe (bao gồm biển số và địa chỉ đón trả)',
    type: OwnerVehicleDto,
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy xe' })
  @ApiForbiddenResponse({ description: 'Không có quyền truy cập xe của chủ khác' })
  async getOwnerVehicleById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<OwnerVehicleDto> {
    return this.ownerVehiclesService.getOwnerVehicleById(id, user.id);
  }

  @Patch(':id')
  @UseGuards(SessionGuard, CsrfGuard)
  @ApiCookieAuth('access_token')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chủ xe cập nhật thông tin xe' })
  @ApiOkResponse({
    description: 'Cập nhật xe thành công',
    type: OwnerVehicleDto,
  })
  @ApiBadRequestResponse({ description: 'Dữ liệu cập nhật không hợp lệ' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy xe' })
  @ApiForbiddenResponse({ description: 'Không có quyền cập nhật xe của chủ khác' })
  async updateVehicle(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateVehicleDto,
  ): Promise<OwnerVehicleDto> {
    return this.ownerVehiclesService.updateVehicle(id, user.id, dto);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard, CsrfGuard)
  @ApiCookieAuth('access_token')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Chuyển trạng thái xe từ DRAFT sang PUBLISHED để hiển thị trên danh sách tìm kiếm công khai',
  })
  @ApiOkResponse({
    description: 'Xe được đăng công khai thành công',
    type: OwnerVehicleDto,
  })
  @ApiNotFoundResponse({ description: 'Không tìm thấy xe' })
  @ApiForbiddenResponse({ description: 'Không có quyền publish xe của chủ khác' })
  @ApiUnprocessableEntityResponse({
    description: 'Xe chưa đủ điều kiện publish (thiếu ảnh hoặc giấy tờ)',
  })
  async publishVehicle(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<OwnerVehicleDto> {
    return this.ownerVehiclesService.publishVehicle(id, user.id);
  }
}
