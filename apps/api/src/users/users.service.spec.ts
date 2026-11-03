import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { UsersService } from './users.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('UsersService (Unit) - G1-02', () => {
  let usersService: UsersService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      driverLicense: {
        findUnique: async ({ where }: any) => {
          if (where.userId === 'user-verified-id') {
            return {
              id: 'license-1',
              userId: 'user-verified-id',
              licenseNumber: '079199012345',
              fullName: 'NGUYỄN VĂN CHỦ',
              dateOfBirth: new Date('1995-05-15'),
              licenseClass: 'B2',
              expiryDate: new Date('2030-05-15'),
              status: 'VERIFIED',
              verifiedAt: new Date(),
              rejectionReason: null,
            };
          }
          return null;
        },
        upsert: async ({ create }: any) => {
          return {
            id: 'license-new-id',
            userId: create.userId,
            licenseNumber: create.licenseNumber,
            fullName: create.fullName,
            dateOfBirth: create.dateOfBirth,
            licenseClass: create.licenseClass,
            expiryDate: create.expiryDate,
            status: 'PENDING',
            verifiedAt: null,
            rejectionReason: null,
          };
        },
        update: async ({ data, where }: any) => {
          return {
            id: 'license-new-id',
            userId: where.userId,
            licenseNumber: '079199012345',
            fullName: 'NGUYỄN VĂN CHỦ',
            dateOfBirth: new Date('1995-05-15'),
            licenseClass: 'B2',
            expiryDate: new Date('2030-05-15'),
            status: data.status,
            verifiedAt: data.verifiedAt,
            rejectionReason: data.rejectionReason,
          };
        },
      },
      user: {
        update: async () => ({}),
      },
      $transaction: async (cb: any) => cb(mockPrisma),
    };

    usersService = new UsersService(mockPrisma as unknown as PrismaService);
  });

  it('1. should submit valid driver license and set status to PENDING', async () => {
    const futureExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const result = await usersService.submitDriverLicense('user-new-id', {
      licenseNumber: '079199012345',
      fullName: 'Mới 1',
      dateOfBirth: '1998-08-20',
      licenseClass: 'B2',
      expiryDate: futureExpiry as string,
    });

    assert.equal(result.status, 'PENDING');
    assert.equal(result.licenseNumber, '079199012345');
    assert.equal(result.licenseClass, 'B2');
  });

  it('2. should reject driver license expiring in less than 30 days', async () => {
    const soonExpiry = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    await assert.rejects(
      async () => {
        await usersService.submitDriverLicense('user-new-id', {
          licenseNumber: '079199012345',
          fullName: 'Mới 1',
          dateOfBirth: '1998-08-20',
          licenseClass: 'B2',
          expiryDate: soonExpiry as string,
        });
      },
      (err: any) => {
        assert.equal(err.status, 400);
        return true;
      },
    );
  });

  it('3. should reject driver license if driver is under 18 years old', async () => {
    const futureExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const tooYoungDob = new Date(Date.now() - 16 * 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    await assert.rejects(
      async () => {
        await usersService.submitDriverLicense('user-new-id', {
          licenseNumber: '079199012345',
          fullName: 'Mới 2',
          dateOfBirth: tooYoungDob as string,
          licenseClass: 'B1',
          expiryDate: futureExpiry as string,
        });
      },
      (err: any) => {
        assert.equal(err.status, 400);
        return true;
      },
    );
  });

  it('4. should reject re-submission if driver license is already VERIFIED (409 ALREADY_VERIFIED)', async () => {
    const futureExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    await assert.rejects(
      async () => {
        await usersService.submitDriverLicense('user-verified-id', {
          licenseNumber: '079199012345',
          fullName: 'NGUYỄN VĂN CHỦ',
          dateOfBirth: '1995-05-15',
          licenseClass: 'B2',
          expiryDate: futureExpiry as string,
        });
      },
      (err: any) => {
        assert.equal(err.status, 409);
        const res = err.getResponse();
        assert.equal(res.code, 'ALREADY_VERIFIED');
        return true;
      },
    );
  });

  it('5. should verify driver license successfully (VERIFIED)', async () => {
    const result = await usersService.verifyDriverLicense('user-verified-id', {
      status: 'VERIFIED',
    });

    assert.equal(result.status, 'VERIFIED');
    assert.ok(result.verifiedAt);
  });

  it('6. should reject license rejection when reason is missing', async () => {
    await assert.rejects(
      async () => {
        await usersService.verifyDriverLicense('user-verified-id', {
          status: 'REJECTED',
        });
      },
      (err: any) => {
        assert.equal(err.status, 400);
        return true;
      },
    );
  });
});
