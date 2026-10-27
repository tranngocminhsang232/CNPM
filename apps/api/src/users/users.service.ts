import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  DriverLicenseDto,
  SubmitDriverLicenseDto,
  VerifyDriverLicenseDto,
} from './dto/submit-license.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getDriverLicense(userId: string): Promise<DriverLicenseDto | null> {
    const license = await this.prisma.driverLicense.findUnique({
      where: { userId },
    });

    if (!license) return null;
    return this.mapToDto(license);
  }

  async submitDriverLicense(
    userId: string,
    dto: SubmitDriverLicenseDto,
  ): Promise<DriverLicenseDto> {
    // 1. Kiểm tra ngày hết hạn còn ít nhất 30 ngày
    const expiry = new Date(dto.expiryDate);
    const minExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    if (isNaN(expiry.getTime()) || expiry < minExpiry) {
      throw new BadRequestException({
        message: 'Giấy phép lái xe phải còn thời hạn ít nhất 30 ngày',
        code: 'VALIDATION_ERROR',
      });
    }

    // 2. Kiểm tra độ tuổi tối thiểu 18 tuổi
    const dob = new Date(dto.dateOfBirth);
    const maxDob = new Date();
    maxDob.setFullYear(maxDob.getFullYear() - 18);
    if (isNaN(dob.getTime()) || dob > maxDob) {
      throw new BadRequestException({
        message: 'Người lái xe phải từ đủ 18 tuổi trở lên',
        code: 'VALIDATION_ERROR',
      });
    }

    // 3. Kiểm tra nếu đã được xác thực trước đó
    const existing = await this.prisma.driverLicense.findUnique({
      where: { userId },
    });

    if (existing && existing.status === 'VERIFIED') {
      throw new ConflictException({
        message: 'Giấy phép lái xe đã được xác thực thành công, không thể gửi lại',
        code: 'ALREADY_VERIFIED',
      });
    }

    // 4. Lưu hồ sơ GPLX và cập nhật trạng thái KYC của User
    const record = await this.prisma.$transaction(async (tx) => {
      const license = await tx.driverLicense.upsert({
        where: { userId },
        create: {
          userId,
          licenseNumber: dto.licenseNumber,
          fullName: dto.fullName,
          dateOfBirth: dob,
          licenseClass: dto.licenseClass,
          expiryDate: expiry,
          status: 'PENDING',
        },
        update: {
          licenseNumber: dto.licenseNumber,
          fullName: dto.fullName,
          dateOfBirth: dob,
          licenseClass: dto.licenseClass,
          expiryDate: expiry,
          status: 'PENDING',
          rejectionReason: null,
          verifiedAt: null,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { kycStatus: 'PENDING' },
      });

      return license;
    });

    return this.mapToDto(record);
  }

  async verifyDriverLicense(
    userId: string,
    dto: VerifyDriverLicenseDto,
  ): Promise<DriverLicenseDto> {
    const existing = await this.prisma.driverLicense.findUnique({
      where: { userId },
    });

    if (!existing) {
      throw new NotFoundException({
        message: 'Không tìm thấy hồ sơ giấy phép lái xe của người dùng',
        code: 'NOT_FOUND',
      });
    }

    if (dto.status === 'REJECTED' && !dto.rejectionReason) {
      throw new BadRequestException({
        message: 'Lý do từ chối không được để trống khi từ chối GPLX',
        code: 'VALIDATION_ERROR',
      });
    }

    const verifiedAt = dto.status === 'VERIFIED' ? new Date() : null;
    const rejectionReason = dto.status === 'REJECTED' ? dto.rejectionReason : null;

    const record = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.driverLicense.update({
        where: { userId },
        data: {
          status: dto.status,
          verifiedAt,
          rejectionReason,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { kycStatus: dto.status },
      });

      return updated;
    });

    return this.mapToDto(record);
  }

  private mapToDto(license: {
    id: string;
    userId: string;
    licenseNumber: string;
    fullName: string;
    dateOfBirth: Date;
    licenseClass: string;
    expiryDate: Date;
    status: string;
    verifiedAt: Date | null;
    rejectionReason: string | null;
  }): DriverLicenseDto {
    return {
      id: license.id,
      userId: license.userId,
      licenseNumber: license.licenseNumber,
      fullName: license.fullName,
      dateOfBirth: license.dateOfBirth.toISOString().split('T')[0] || '',
      licenseClass: license.licenseClass,
      expiryDate: license.expiryDate.toISOString().split('T')[0] || '',
      status: license.status,
      verifiedAt: license.verifiedAt?.toISOString() ?? null,
      rejectionReason: license.rejectionReason,
    };
  }
}
