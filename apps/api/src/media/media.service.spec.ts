import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MediaPurpose, MediaState } from '@prisma/client';
import { MediaService } from './media.service';
import { MediaPurposeEnum } from './dto/media.dto';

describe('MediaService (Unit) - G1-03', () => {
  const fakeConfigService = {
    get: (key: string) => {
      const config: Record<string, string> = {
        S3_BUCKET_PRIVATE: 'car-sharing-private',
        S3_ENDPOINT: 'http://localhost:9000',
        S3_REGION: 'us-east-1',
        S3_ACCESS_KEY: 'minioadmin',
        S3_SECRET_KEY: 'minioadmin',
      };
      return config[key];
    },
  } as any;

  it('1. should create upload intent and generate presigned PUT url', async () => {
    let createdData: any = null;
    const fakePrisma = {
      mediaObject: {
        create: async ({ data }: any) => {
          createdData = data;
          return {
            id: data.id,
            ...data,
          };
        },
      },
    } as any;

    const service = new MediaService(fakePrisma, fakeConfigService);

    const intent = await service.createUploadIntent('00000000-0000-0000-0000-000000000001', {
      purpose: MediaPurposeEnum.IDENTITY_DOCUMENT,
      mimeType: 'image/jpeg',
      sizeBytes: 204800,
    });

    assert.ok(intent.mediaId);
    assert.ok(intent.uploadUrl.includes('car-sharing-private'));
    assert.deepEqual(intent.headers, { 'Content-Type': 'image/jpeg' });
    assert.equal(createdData.purpose, MediaPurpose.IDENTITY_DOCUMENT);
    assert.equal(createdData.mimeType, 'image/jpeg');
    assert.equal(createdData.state, MediaState.STAGING);
  });

  it('2. should reject verification if media not found (404)', async () => {
    const fakePrisma = {
      mediaObject: {
        findUnique: async () => null,
      },
    } as any;

    const service = new MediaService(fakePrisma, fakeConfigService);

    await assert.rejects(
      async () => service.verifyMedia('50000000-0000-0000-0000-000000000001', 'user-1'),
      (err: any) => err instanceof NotFoundException,
    );
  });

  it('3. should reject verification if user is not the uploader (403)', async () => {
    const fakePrisma = {
      mediaObject: {
        findUnique: async () => ({
          id: '50000000-0000-0000-0000-000000000001',
          uploaderId: 'user-1',
          purpose: MediaPurpose.IDENTITY_DOCUMENT,
          state: MediaState.STAGING,
        }),
      },
    } as any;

    const service = new MediaService(fakePrisma, fakeConfigService);

    await assert.rejects(
      async () => service.verifyMedia('50000000-0000-0000-0000-000000000001', 'attacker-user'),
      (err: any) => err instanceof ForbiddenException,
    );
  });

  it('4. should reject getReadUrl if media is not VERIFIED (400)', async () => {
    const fakePrisma = {
      mediaObject: {
        findUnique: async () => ({
          id: '50000000-0000-0000-0000-000000000001',
          uploaderId: 'user-1',
          purpose: MediaPurpose.IDENTITY_DOCUMENT,
          state: MediaState.STAGING,
        }),
      },
    } as any;

    const service = new MediaService(fakePrisma, fakeConfigService);

    await assert.rejects(
      async () => service.getReadUrl('50000000-0000-0000-0000-000000000001', 'user-1'),
      (err: any) => err instanceof BadRequestException,
    );
  });

  it('5. should reject getReadUrl for IDENTITY_DOCUMENT if requester is not uploader (403)', async () => {
    const fakePrisma = {
      mediaObject: {
        findUnique: async () => ({
          id: '50000000-0000-0000-0000-000000000001',
          uploaderId: 'user-1',
          purpose: MediaPurpose.IDENTITY_DOCUMENT,
          state: MediaState.VERIFIED,
          finalKey: 'finalized/identity_document/license.jpg',
        }),
      },
    } as any;

    const service = new MediaService(fakePrisma, fakeConfigService);

    // Another user tries to read
    await assert.rejects(
      async () => service.getReadUrl('50000000-0000-0000-0000-000000000001', 'attacker-user'),
      (err: any) => err instanceof ForbiddenException,
    );

    // Anonymous user tries to read
    await assert.rejects(
      async () => service.getReadUrl('50000000-0000-0000-0000-000000000001', undefined),
      (err: any) => err instanceof ForbiddenException,
    );
  });

  it('6. should allow getReadUrl for IDENTITY_DOCUMENT if requester is the uploader', async () => {
    const fakePrisma = {
      mediaObject: {
        findUnique: async () => ({
          id: '50000000-0000-0000-0000-000000000001',
          uploaderId: 'user-1',
          purpose: MediaPurpose.IDENTITY_DOCUMENT,
          state: MediaState.VERIFIED,
          finalKey: 'finalized/identity_document/license.jpg',
        }),
      },
    } as any;

    const service = new MediaService(fakePrisma, fakeConfigService);

    const result = await service.getReadUrl('50000000-0000-0000-0000-000000000001', 'user-1');
    assert.ok(result.url.includes('finalized/identity_document/license.jpg'));
    assert.ok(result.expiresAt);
  });

  it('7. should allow getReadUrl for VEHICLE_PHOTO even for anonymous requester', async () => {
    const fakePrisma = {
      mediaObject: {
        findUnique: async () => ({
          id: '50000000-0000-0000-0000-000000000002',
          uploaderId: 'user-1',
          purpose: MediaPurpose.VEHICLE_PHOTO,
          state: MediaState.VERIFIED,
          finalKey: 'finalized/vehicle_photo/car.jpg',
        }),
      },
    } as any;

    const service = new MediaService(fakePrisma, fakeConfigService);

    const result = await service.getReadUrl('50000000-0000-0000-0000-000000000002', undefined);
    assert.ok(result.url.includes('finalized/vehicle_photo/car.jpg'));
    assert.ok(result.expiresAt);
  });
});
