import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { OptionalSessionGuard } from '../auth/guards/optional-session.guard';
import { SessionGuard } from '../auth/guards/session.guard';
import {
  CreateUploadIntentDto,
  MediaObjectDto,
  MediaReadUrlResponseDto,
  UploadIntentResponseDto,
} from './dto/media.dto';
import { MediaService } from './media.service';

@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload-intents')
  @UseGuards(SessionGuard, CsrfGuard)
  @ApiCookieAuth('access_token')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Tạo upload intent và sinh Presigned PUT URL để upload trực tiếp lên S3/MinIO',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Sinh presigned URL thành công',
    type: UploadIntentResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Dữ liệu không hợp lệ (MIME hoặc dung lượng sai quy định)',
  })
  async createUploadIntent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateUploadIntentDto,
  ): Promise<UploadIntentResponseDto> {
    return this.mediaService.createUploadIntent(user.id, dto);
  }

  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard, CsrfGuard)
  @ApiCookieAuth('access_token')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Xác thực file đã tải lên storage thành công (probe S3) và chuyển trạng thái sang VERIFIED',
  })
  @ApiOkResponse({
    description: 'Xác thực file thành công, file được chuyển từ staging sang finalized',
    type: MediaObjectDto,
  })
  @ApiBadRequestResponse({ description: 'File chưa được tải lên storage thành công' })
  @ApiForbiddenResponse({ description: 'Không có quyền xác thực media của người khác' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy media object' })
  async verifyMedia(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<MediaObjectDto> {
    return this.mediaService.verifyMedia(id, user.id);
  }

  @Get(':id/read-url')
  @UseGuards(OptionalSessionGuard)
  @ApiCookieAuth('access_token')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Lấy Presigned GET URL để xem file media (kiểm tra phân quyền tài liệu nhạy cảm)',
  })
  @ApiOkResponse({
    description: 'Sinh URL xem file thành công (TTL 15 phút)',
    type: MediaReadUrlResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Không có quyền truy cập tài liệu định danh này' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy media object' })
  @ApiBadRequestResponse({ description: 'Media chưa hoàn tất xác thực' })
  async getReadUrl(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<MediaReadUrlResponseDto> {
    return this.mediaService.getReadUrl(id, user?.id);
  }

  @Get('vehicles/:id/:filename')
  @ApiOperation({ summary: 'Xem ảnh xe công khai' })
  async getVehicleImage(
    @Param('id') id: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.mediaService.streamMedia(`vehicles/${id}/${filename}`, res);
  }

  @Get('finalized/:purpose/:filename')
  @ApiOperation({ summary: 'Xem media đã xác thực công khai' })
  async getFinalizedImage(
    @Param('purpose') purpose: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.mediaService.streamMedia(`finalized/${purpose}/${filename}`, res);
  }

  @Get('staging/:filename')
  @ApiOperation({ summary: 'Xem media staging' })
  async getStagingImage(
    @Param('filename') filename: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.mediaService.streamMedia(`staging/${filename}`, res);
  }
}
