import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { LoginDto, RegisterDto, UserDto } from './dto/auth.dto';

interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  capabilities: string[];
  type: 'access' | 'refresh';
  familyId?: string;
}

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.accessSecret =
      this.configService.get<string>('JWT_ACCESS_SECRET') ||
      'carsharing_access_jwt_secret_dev_local_2026';
    this.refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      'carsharing_refresh_jwt_secret_dev_local_2026';
  }

  // ---------------------------------------------------------------------------
  // CSRF Token Management
  // ---------------------------------------------------------------------------
  generateCsrfToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // ---------------------------------------------------------------------------
  // Authentication: Login & Register
  // ---------------------------------------------------------------------------
  async login(loginDto: LoginDto): Promise<{
    user: UserDto;
    accessToken: string;
    refreshToken: string;
    csrfToken: string;
  }> {
    const emailNormalized = loginDto.email.toLowerCase().trim();

    const user = await this.prisma.user.findUnique({
      where: { emailNormalized },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException({
        message: 'Email hoặc mật khẩu không chính xác',
        code: 'INVALID_CREDENTIALS',
      });
    }

    const isMatch = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException({
        message: 'Email hoặc mật khẩu không chính xác',
        code: 'INVALID_CREDENTIALS',
      });
    }

    const userDto = this.mapToUserDto(user);
    const { accessToken, refreshToken } = await this.createTokensAndSession(userDto);
    const csrfToken = this.generateCsrfToken();

    return { user: userDto, accessToken, refreshToken, csrfToken };
  }

  async register(registerDto: RegisterDto): Promise<{
    user: UserDto;
    accessToken: string;
    refreshToken: string;
    csrfToken: string;
  }> {
    const emailNormalized = registerDto.email.toLowerCase().trim();

    const existing = await this.prisma.user.findUnique({
      where: { emailNormalized },
    });

    if (existing) {
      throw new ConflictException({
        message: 'Email này đã được sử dụng',
        code: 'EMAIL_IN_USE',
      });
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: registerDto.name.trim(),
        emailNormalized,
        phone: registerDto.phone.trim(),
        passwordHash,
      },
    });

    const userDto = this.mapToUserDto(user);
    const { accessToken, refreshToken } = await this.createTokensAndSession(userDto);
    const csrfToken = this.generateCsrfToken();

    return { user: userDto, accessToken, refreshToken, csrfToken };
  }

  // ---------------------------------------------------------------------------
  // Google OIDC Support (Real / Test Callback)
  // ---------------------------------------------------------------------------
  async handleGoogleOidcUser(googleUser: {
    email: string;
    name: string;
    subject: string;
  }): Promise<{
    user: UserDto;
    accessToken: string;
    refreshToken: string;
    csrfToken: string;
  }> {
    const emailNormalized = googleUser.email.toLowerCase().trim();

    // Tìm kiếm hoặc tạo mới user
    let user = await this.prisma.user.findUnique({
      where: { emailNormalized },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          name: googleUser.name.trim(),
          emailNormalized,
          phone: '',
          oauthAccounts: {
            create: {
              provider: 'google',
              subject: googleUser.subject,
            },
          },
        },
      });
    } else {
      // Đảm bảo oauth_accounts đã liên kết
      const existingOauth = await this.prisma.oAuthAccount.findUnique({
        where: {
          provider_subject: {
            provider: 'google',
            subject: googleUser.subject,
          },
        },
      });
      if (!existingOauth) {
        await this.prisma.oAuthAccount.create({
          data: {
            userId: user.id,
            provider: 'google',
            subject: googleUser.subject,
          },
        });
      }
    }

    const userDto = this.mapToUserDto(user);
    const { accessToken, refreshToken } = await this.createTokensAndSession(userDto);
    const csrfToken = this.generateCsrfToken();

    return { user: userDto, accessToken, refreshToken, csrfToken };
  }

  // ---------------------------------------------------------------------------
  // Session Validation & Logout
  // ---------------------------------------------------------------------------
  async validateAccessToken(token: string): Promise<UserDto | null> {
    try {
      const decoded = jwt.verify(token, this.accessSecret) as JwtPayload;
      if (decoded.type !== 'access') return null;

      const user = await this.prisma.user.findUnique({
        where: { id: decoded.sub },
      });

      if (!user) return null;
      return this.mapToUserDto(user);
    } catch {
      return null;
    }
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await this.prisma.refreshSession.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else {
      // Thu hồi tất cả phiên còn hiệu lực của user
      await this.prisma.refreshSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  private async createTokensAndSession(
    user: UserDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const familyId = crypto.randomUUID();

    // Access Token: 15 phút (ADR-16)
    const accessToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        capabilities: user.capabilities,
        type: 'access',
      },
      this.accessSecret,
      { expiresIn: '15m' },
    );

    // Refresh Token: 7 ngày (ADR-16)
    const refreshToken = jwt.sign(
      {
        sub: user.id,
        familyId,
        type: 'refresh',
      },
      this.refreshSecret,
      { expiresIn: '7d' },
    );

    // Lưu phiên refresh session vào DB
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshSession.create({
      data: {
        userId: user.id,
        tokenHash,
        familyId,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  private mapToUserDto(user: {
    id: string;
    name: string;
    emailNormalized: string;
    phone: string;
    kycStatus?: any;
  }): UserDto {
    return {
      id: user.id,
      name: user.name,
      email: user.emailNormalized,
      phone: user.phone,
      kycStatus: user.kycStatus || 'NONE',
      // Capability Model (ADR-04): Mọi user đều có năng lực cả RENTER lẫn OWNER
      capabilities: ['RENTER', 'OWNER'],
    };
  }
}
