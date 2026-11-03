import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CopyObjectCommand,
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { MediaPurpose, MediaState } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateUploadIntentDto,
  MediaObjectDto,
  MediaPurposeEnum,
  MediaReadUrlResponseDto,
  UploadIntentResponseDto,
} from './dto/media.dto';

@Injectable()
export class MediaService implements OnModuleInit {
  private readonly s3Client: S3Client;
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.bucket =
      this.configService.get<string>('S3_BUCKET_PRIVATE') ||
      this.configService.get<string>('S3_BUCKET') ||
      'car-sharing-private';
    const endpoint = this.configService.get<string>('S3_ENDPOINT') || 'http://localhost:9000';
    const region = this.configService.get<string>('S3_REGION') || 'us-east-1';
    const accessKeyId =
      this.configService.get<string>('S3_ACCESS_KEY') ||
      this.configService.get<string>('S3_ACCESS_KEY_ID') ||
      'minioadmin';
    const secretAccessKey =
      this.configService.get<string>('S3_SECRET_KEY') ||
      this.configService.get<string>('S3_SECRET_ACCESS_KEY') ||
      'minioadmin';

    this.s3Client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true,
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.s3Client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    } catch (err: any) {
      if (err?.name !== 'BucketAlreadyOwnedByYou' && err?.name !== 'BucketAlreadyExists') {
        // Log or silently ignore benign bucket initialization error in non-S3 environments
      }
    }
  }

  async createUploadIntent(
    uploaderId: string,
    dto: CreateUploadIntentDto,
  ): Promise<UploadIntentResponseDto> {
    const mediaId = randomUUID();
    const ext = dto.mimeType === 'image/png' ? '.png' : '.jpg';
    const stagingKey = `staging/${mediaId}${ext}`;

    const media = await this.prisma.mediaObject.create({
      data: {
        id: mediaId,
        uploaderId,
        purpose: dto.purpose as unknown as MediaPurpose,
        vehicleId: dto.vehicleId ?? null,
        bookingId: dto.bookingId ?? null,
        stagingKey,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        checksum: 'pending',
        state: MediaState.STAGING,
      },
    });

    const putCmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: stagingKey,
      ContentType: dto.mimeType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, putCmd, { expiresIn: 900 });
    const expiresAt = new Date(Date.now() + 900 * 1000).toISOString();

    return {
      mediaId: media.id,
      uploadUrl,
      headers: {
        'Content-Type': dto.mimeType,
      },
      expiresAt,
    };
  }

  async verifyMedia(mediaId: string, uploaderId: string): Promise<MediaObjectDto> {
    const media = await this.prisma.mediaObject.findUnique({
      where: { id: mediaId },
    });

    if (!media) {
      throw new NotFoundException(`Không tìm thấy media với ID: ${mediaId}`);
    }

    if (media.uploaderId !== uploaderId) {
      throw new ForbiddenException('Bạn không có quyền xác thực media này');
    }

    if (media.state === MediaState.VERIFIED) {
      return this.mapToDto(media);
    }

    let head;
    try {
      head = await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: media.stagingKey,
        }),
      );
    } catch {
      throw new BadRequestException('File chưa được tải lên storage thành công');
    }

    const ext = media.mimeType === 'image/png' ? '.png' : '.jpg';
    const finalKey = `finalized/${media.purpose.toLowerCase()}/${media.id}${ext}`;

    await this.s3Client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${media.stagingKey}`,
        Key: finalKey,
      }),
    );

    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: media.stagingKey,
      }),
    );

    const updated = await this.prisma.mediaObject.update({
      where: { id: media.id },
      data: {
        finalKey,
        checksum: head.ETag?.replace(/"/g, '') || 'verified',
        sizeBytes: head.ContentLength ?? media.sizeBytes,
        state: MediaState.VERIFIED,
        verifiedAt: new Date(),
      },
    });

    return this.mapToDto(updated);
  }

  async getReadUrl(mediaId: string, requestingUserId?: string): Promise<MediaReadUrlResponseDto> {
    const media = await this.prisma.mediaObject.findUnique({
      where: { id: mediaId },
    });

    if (!media) {
      throw new NotFoundException(`Không tìm thấy media với ID: ${mediaId}`);
    }

    if (media.state !== MediaState.VERIFIED) {
      throw new BadRequestException('Media chưa hoàn tất xác minh');
    }

    if (media.purpose === MediaPurpose.IDENTITY_DOCUMENT) {
      if (!requestingUserId || requestingUserId !== media.uploaderId) {
        throw new ForbiddenException('Bạn không có quyền truy cập tài liệu định danh này');
      }
    }

    const targetKey = media.finalKey || media.stagingKey;
    const getCmd = new GetObjectCommand({
      Bucket: this.bucket,
      Key: targetKey,
    });

    const url = await getSignedUrl(this.s3Client, getCmd, { expiresIn: 900 });
    const expiresAt = new Date(Date.now() + 900 * 1000).toISOString();

    return {
      url,
      expiresAt,
    };
  }

  async streamMedia(key: string, res: Response): Promise<void> {
    // 1. Try MinIO S3 first
    try {
      const getCmd = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      const response = await this.s3Client.send(getCmd);
      if (response.Body) {
        res.setHeader('Content-Type', response.ContentType || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        const stream = response.Body as unknown as NodeJS.ReadableStream;
        stream.pipe(res);
        return;
      }
    } catch {
      // S3 object not found or error, fallback to local file
    }

    // 2. Try local files
    const ext = path.extname(key).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

    const possiblePaths = [
      path.resolve(process.cwd(), 'assets', key),
      path.resolve(process.cwd(), 'apps/api/assets', key),
      path.resolve(process.cwd(), '../web/public/images', key),
      path.resolve(process.cwd(), 'apps/web/public/images', key),
      path.resolve(__dirname, '../../../assets', key),
      path.resolve(__dirname, '../../../../apps/web/public/images', key),
    ];

    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', mime);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        fs.createReadStream(filePath).pipe(res);
        return;
      }
    }

    // 3. Fallback to default car image if vehicle photo
    const fallbackPaths = [
      path.resolve(process.cwd(), 'assets/vehicles/default-car.jpg'),
      path.resolve(process.cwd(), 'apps/api/assets/vehicles/default-car.jpg'),
      path.resolve(process.cwd(), 'apps/web/public/images/vehicles/default-car.jpg'),
      path.resolve(__dirname, '../../../assets/vehicles/default-car.jpg'),
    ];
    for (const fb of fallbackPaths) {
      if (fs.existsSync(fb)) {
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        fs.createReadStream(fb).pipe(res);
        return;
      }
    }

    throw new NotFoundException(`Media không tồn tại: ${key}`);
  }

  private mapToDto(media: {
    id: string;
    uploaderId: string;
    purpose: MediaPurpose;
    mimeType: string;
    sizeBytes: number;
    state: MediaState;
    verifiedAt: Date | null;
  }): MediaObjectDto {
    return {
      id: media.id,
      uploaderId: media.uploaderId,
      purpose: media.purpose as unknown as MediaPurposeEnum,
      mimeType: media.mimeType,
      sizeBytes: media.sizeBytes,
      state: media.state,
      verifiedAt: media.verifiedAt ? media.verifiedAt.toISOString() : null,
    };
  }
}
