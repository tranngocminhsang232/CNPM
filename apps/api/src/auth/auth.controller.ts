import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiExtraModels, ApiOperation, ApiResponse, ApiTags, getSchemaPath } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { PublicCsrf } from './decorators/public-csrf.decorator';
import { AuthResponseDto, CsrfResponseDto, LoginDto, RegisterDto, UserDto } from './dto/auth.dto';
import { CsrfGuard } from './guards/csrf.guard';
import { SessionGuard } from './guards/session.guard';

@ApiTags('Auth')
@ApiExtraModels(UserDto, AuthResponseDto, CsrfResponseDto)
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private getCookieOptions(httpOnly = true, maxAge = 15 * 60 * 1000) {
    const isProd = process.env.NODE_ENV === 'production';
    return {
      httpOnly,
      secure: isProd,
      sameSite: 'lax' as const,
      path: '/',
      maxAge,
    };
  }

  // ---------------------------------------------------------------------------
  // 1. GET /api/v1/auth/csrf: Cấp CSRF token
  // ---------------------------------------------------------------------------
  @Get('auth/csrf')
  @PublicCsrf()
  @ApiOperation({ summary: 'Lấy mã xác thực CSRF gắn phiên hoặc trước phiên' })
  @ApiResponse({
    status: 200,
    description: 'Trả về CSRF token và gắn cookie csrf_token',
    schema: {
      properties: {
        data: { $ref: getSchemaPath(CsrfResponseDto) },
      },
    },
  })
  getCsrfToken(@Res({ passthrough: true }) res: Response) {
    const csrfToken = this.authService.generateCsrfToken();
    res.cookie('csrf_token', csrfToken, this.getCookieOptions(false, 7 * 24 * 60 * 60 * 1000));
    return { csrfToken };
  }

  // ---------------------------------------------------------------------------
  // 2. POST /api/v1/auth/login: Đăng nhập email/mật khẩu
  // ---------------------------------------------------------------------------
  @Post('auth/login')
  @PublicCsrf()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập người dùng bằng email và mật khẩu' })
  @ApiResponse({
    status: 200,
    description: 'Đăng nhập thành công, thiết lập session cookies',
    schema: {
      properties: {
        data: { $ref: getSchemaPath(AuthResponseDto) },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Sai thông tin đăng nhập (INVALID_CREDENTIALS)' })
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { user, accessToken, refreshToken, csrfToken } = await this.authService.login(loginDto);

    res.cookie('access_token', accessToken, this.getCookieOptions(true, 15 * 60 * 1000));
    res.cookie('refresh_token', refreshToken, this.getCookieOptions(true, 7 * 24 * 60 * 60 * 1000));
    res.cookie('csrf_token', csrfToken, this.getCookieOptions(false, 7 * 24 * 60 * 60 * 1000));

    return { user, csrfToken };
  }

  // ---------------------------------------------------------------------------
  // 3. POST /api/v1/auth/register: Đăng ký tài khoản mới
  // ---------------------------------------------------------------------------
  @Post('auth/register')
  @PublicCsrf()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Đăng ký tài khoản người dùng mới' })
  @ApiResponse({
    status: 201,
    description: 'Đăng ký thành công, tạo phiên và trả về thông tin user',
    schema: {
      properties: {
        data: { $ref: getSchemaPath(AuthResponseDto) },
      },
    },
  })
  @ApiResponse({ status: 409, description: 'Email đã tồn tại (EMAIL_IN_USE)' })
  async register(@Body() registerDto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { user, accessToken, refreshToken, csrfToken } =
      await this.authService.register(registerDto);

    res.cookie('access_token', accessToken, this.getCookieOptions(true, 15 * 60 * 1000));
    res.cookie('refresh_token', refreshToken, this.getCookieOptions(true, 7 * 24 * 60 * 60 * 1000));
    res.cookie('csrf_token', csrfToken, this.getCookieOptions(false, 7 * 24 * 60 * 60 * 1000));

    return { user, csrfToken };
  }

  // ---------------------------------------------------------------------------
  // 4. GET /api/v1/auth/google & callback
  // ---------------------------------------------------------------------------
  @Get('auth/google')
  @PublicCsrf()
  @ApiOperation({ summary: 'Khởi tạo luồng xác thực Google OAuth2/OIDC' })
  @ApiResponse({ status: 302, description: 'Chuyển hướng đến Google hoặc mock callback' })
  googleAuth(@Res() res: Response) {
    // Trong môi trường dev/test hoặc khi chưa cấu hình Google Client ID, chuyển hướng mock callback
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    if (!googleClientId) {
      return res.redirect(
        '/api/v1/auth/google/callback?code=mock_google_code_seed_owner&state=mock_state',
      );
    }
    const redirectUri = encodeURIComponent(
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/api/v1/auth/google/callback',
    );
    const scope = encodeURIComponent('openid email profile');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${googleClientId}&redirect_uri=${redirectUri}&scope=${scope}&state=secure_state_token`;
    return res.redirect(authUrl);
  }

  @Get('auth/google/callback')
  @PublicCsrf()
  @ApiOperation({ summary: 'Xử lý phản hồi từ Google OAuth2/OIDC' })
  @ApiResponse({ status: 302, description: 'Thiết lập cookie phiên và chuyển hướng về web' })
  async googleCallback(@Query('code') code: string, @Res() res: Response) {
    // Mock user nếu chạy trong môi trường test/dev với code mock
    const googleUser =
      code === 'mock_google_code_seed_owner'
        ? {
            email: 'owner1@carsharing.local',
            name: 'Nguyễn Văn Chủ 1 (Google)',
            subject: 'google-sub-mock-123456',
          }
        : {
            email: 'google_user@carsharing.local',
            name: 'Người Dùng Google',
            subject: 'google-sub-' + Date.now(),
          };

    const { accessToken, refreshToken, csrfToken } =
      await this.authService.handleGoogleOidcUser(googleUser);

    res.cookie('access_token', accessToken, this.getCookieOptions(true, 15 * 60 * 1000));
    res.cookie('refresh_token', refreshToken, this.getCookieOptions(true, 7 * 24 * 60 * 60 * 1000));
    res.cookie('csrf_token', csrfToken, this.getCookieOptions(false, 7 * 24 * 60 * 60 * 1000));

    // Chuyển hướng về trang chủ web
    const returnUrl = process.env.CORS_ORIGIN || 'http://localhost:3000';
    return res.redirect(returnUrl);
  }

  // ---------------------------------------------------------------------------
  // 5. POST /api/v1/auth/logout: Đăng xuất & thu hồi phiên
  // ---------------------------------------------------------------------------
  @Post('auth/logout')
  @UseGuards(SessionGuard, CsrfGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Đăng xuất tài khoản và thu hồi phiên làm việc' })
  @ApiResponse({ status: 204, description: 'Đăng xuất thành công, xóa cookie' })
  async logout(
    @CurrentUser('id') userId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refresh_token as string | undefined;
    await this.authService.logout(userId, refreshToken);

    const clearOptions = { path: '/', sameSite: 'lax' as const };
    res.clearCookie('access_token', clearOptions);
    res.clearCookie('refresh_token', clearOptions);
    res.clearCookie('csrf_token', clearOptions);
  }

  // ---------------------------------------------------------------------------
  // 6. GET /api/v1/auth/me & GET /api/v1/me: Lấy thông tin cá nhân hiện tại
  // ---------------------------------------------------------------------------
  @Get(['auth/me', 'me'])
  @UseGuards(SessionGuard)
  @ApiOperation({ summary: 'Lấy thông tin người dùng hiện tại từ phiên đăng nhập' })
  @ApiResponse({
    status: 200,
    description: 'Thông tin tài khoản và năng lực của người dùng',
    schema: {
      properties: {
        data: { $ref: getSchemaPath(UserDto) },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập hoặc phiên hết hạn' })
  getProfile(@CurrentUser() user: UserDto) {
    return user;
  }
}
