import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { SessionGuard } from '../auth/guards/session.guard';
import {
  DriverLicenseDto,
  SubmitDriverLicenseDto,
  VerifyDriverLicenseDto,
} from './dto/submit-license.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiExtraModels(DriverLicenseDto, SubmitDriverLicenseDto, VerifyDriverLicenseDto)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me/driver-license')
  @UseGuards(SessionGuard)
  @ApiOperation({ summary: 'Xem thông tin giấy phép lái xe hiện tại của tôi' })
  @ApiResponse({
    status: 200,
    description: 'Hồ sơ GPLX của người dùng hoặc null nếu chưa nộp',
    schema: {
      properties: {
        data: { $ref: getSchemaPath(DriverLicenseDto), nullable: true },
      },
    },
  })
  async getMyDriverLicense(@CurrentUser('id') userId: string) {
    return this.usersService.getDriverLicense(userId);
  }

  @Post('me/driver-license')
  @UseGuards(SessionGuard, CsrfGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Nộp thông tin giấy phép lái xe (GPLX) để xác thực KYC' })
  @ApiResponse({
    status: 201,
    description: 'Nộp GPLX thành công, trạng thái chuyển sang PENDING',
    schema: {
      properties: {
        data: { $ref: getSchemaPath(DriverLicenseDto) },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu không hợp lệ (hết hạn, < 18 tuổi, sai số GPLX)',
  })
  @ApiResponse({ status: 409, description: 'GPLX đã được xác thực trước đó (ALREADY_VERIFIED)' })
  async submitDriverLicense(
    @CurrentUser('id') userId: string,
    @Body() dto: SubmitDriverLicenseDto,
  ) {
    return this.usersService.submitDriverLicense(userId, dto);
  }

  @Post(':id/driver-license/verify')
  @UseGuards(SessionGuard, CsrfGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Duyệt hoặc từ chối giấy phép lái xe (Admin / Mock Verification)' })
  @ApiParam({ name: 'id', description: 'ID người dùng cần duyệt GPLX' })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật trạng thái KYC thành công',
    schema: {
      properties: {
        data: { $ref: getSchemaPath(DriverLicenseDto) },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy hồ sơ GPLX của người dùng' })
  async verifyDriverLicense(@Param('id') userId: string, @Body() dto: VerifyDriverLicenseDto) {
    return this.usersService.verifyDriverLicense(userId, dto);
  }
}
