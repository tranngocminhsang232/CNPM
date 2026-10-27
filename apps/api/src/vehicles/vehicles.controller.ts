import { Controller, Get, Param, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiExtraModels, getSchemaPath } from '@nestjs/swagger';
import { VehiclesService } from './vehicles.service';
import { QueryVehiclesDto } from './dto/query-vehicles.dto';
import { VehicleOptionsDto } from './dto/vehicle-options.dto';
import { VehicleSummaryDto, PaginationMetaDto } from './dto/vehicle-summary.dto';
import { VehicleDetailDto } from './dto/vehicle-detail.dto';
import { ParseUuidPipe } from '../common';

@ApiTags('Vehicles')
@ApiExtraModels(VehicleSummaryDto, PaginationMetaDto, VehicleDetailDto)
@Controller()
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get('vehicle-options')
  @ApiOperation({
    summary: 'Lấy danh mục các tùy chọn tìm kiếm xe (thành phố, loại xe, hộp số, tiện nghi)',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh mục tùy chọn cho phép tìm kiếm xe',
    type: VehicleOptionsDto,
  })
  getVehicleOptions(): { data: VehicleOptionsDto } {
    const options = this.vehiclesService.getVehicleOptions();
    return { data: options };
  }

  @Get('vehicles')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Tìm kiếm và lấy danh sách xe đã được xuất bản (PUBLISHED)' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách xe thỏa mãn điều kiện lọc và thông tin phân trang',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(VehicleSummaryDto) },
        },
        meta: { $ref: getSchemaPath(PaginationMetaDto) },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Tham số tìm kiếm hoặc khoảng ngày không hợp lệ' })
  async getVehicles(
    @Query() query: QueryVehiclesDto,
  ): Promise<{ data: VehicleSummaryDto[]; meta: PaginationMetaDto }> {
    return this.vehiclesService.getVehicles(query);
  }

  @Get('vehicles/:id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết xe công khai theo ID' })
  @ApiResponse({
    status: 200,
    description: 'Thông tin chi tiết xe công khai (không lộ biển số và địa chỉ đón trả chi tiết)',
    type: VehicleDetailDto,
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy xe hoặc xe chưa được công khai' })
  async getVehicleById(
    @Param('id', new ParseUuidPipe()) id: string,
  ): Promise<{ data: VehicleDetailDto }> {
    const vehicle = await this.vehiclesService.getVehicleById(id);
    return { data: vehicle };
  }
}
