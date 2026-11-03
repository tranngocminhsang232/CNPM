import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from './auth.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ConfigService } from '@nestjs/config';

describe('AuthService (Unit)', () => {
  let authService: AuthService;
  let mockPrisma: any;
  let mockConfig: any;

  const DEMO_PASSWORD_HASH = '$2b$10$.6lgaajgP3o8EukxmC45GeMvjZJBRFpoW.dnlZ0cZAoUN55uWUYKW'; // DemoPassword123!

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: async ({ where }: any) => {
          if (where.emailNormalized === 'owner1@carsharing.local') {
            return {
              id: '00000000-0000-0000-0000-000000000001',
              name: 'Chủ 1',
              emailNormalized: 'owner1@carsharing.local',
              phone: '0901111111',
              passwordHash: DEMO_PASSWORD_HASH,
            };
          }
          if (where.id === '00000000-0000-0000-0000-000000000001') {
            return {
              id: '00000000-0000-0000-0000-000000000001',
              name: 'Chủ 1',
              emailNormalized: 'owner1@carsharing.local',
              phone: '0901111111',
            };
          }
          return null;
        },
        create: async ({ data }: any) => {
          return {
            id: 'mock-new-user-uuid',
            name: data.name,
            emailNormalized: data.emailNormalized,
            phone: data.phone,
            passwordHash: data.passwordHash,
          };
        },
      },
      refreshSession: {
        create: async () => ({ id: 'mock-session-id' }),
        updateMany: async () => ({ count: 1 }),
      },
    };

    mockConfig = {
      get: (key: string) => {
        if (key === 'JWT_ACCESS_SECRET') return 'test_jwt_access_secret_123456';
        if (key === 'JWT_REFRESH_SECRET') return 'test_jwt_refresh_secret_123456';
        return undefined;
      },
    };

    authService = new AuthService(
      mockPrisma as unknown as PrismaService,
      mockConfig as unknown as ConfigService,
    );
  });

  it('1. should login successfully with valid email and password', async () => {
    const result = await authService.login({
      email: 'owner1@carsharing.local',
      password: 'DemoPassword123!',
    });

    assert.ok(result.accessToken, 'Access token should be generated');
    assert.ok(result.refreshToken, 'Refresh token should be generated');
    assert.ok(result.csrfToken, 'CSRF token should be generated');
    assert.equal(result.user.email, 'owner1@carsharing.local');
    assert.equal(result.user.name, 'Chủ 1');
    assert.deepEqual(result.user.capabilities, ['RENTER', 'OWNER'], 'Capability model check');
  });

  it('2. should reject login with incorrect password', async () => {
    await assert.rejects(
      async () => {
        await authService.login({
          email: 'owner1@carsharing.local',
          password: 'WrongPassword999!',
        });
      },
      (err: any) => {
        assert.equal(err.status, 401);
        const response = err.getResponse();
        assert.equal(response.code, 'INVALID_CREDENTIALS');
        return true;
      },
    );
  });

  it('3. should reject login for non-existent user without leaking user existence', async () => {
    await assert.rejects(
      async () => {
        await authService.login({
          email: 'notfound@carsharing.local',
          password: 'DemoPassword123!',
        });
      },
      (err: any) => {
        assert.equal(err.status, 401);
        const response = err.getResponse();
        assert.equal(response.code, 'INVALID_CREDENTIALS');
        return true;
      },
    );
  });

  it('4. should register new user and return tokens with capability model', async () => {
    const result = await authService.register({
      name: 'Khách Hàng Mới',
      email: 'newuser@carsharing.local',
      password: 'StrongPassword2026!#',
      phone: '0988776655',
    });

    assert.ok(result.accessToken);
    assert.equal(result.user.name, 'Khách Hàng Mới');
    assert.equal(result.user.email, 'newuser@carsharing.local');
    assert.deepEqual(result.user.capabilities, ['RENTER', 'OWNER']);
  });

  it('5. should reject registration when email already exists', async () => {
    await assert.rejects(
      async () => {
        await authService.register({
          name: 'Mới 1',
          email: 'owner1@carsharing.local',
          password: 'StrongPassword2026!#',
          phone: '0912345678',
        });
      },
      (err: any) => {
        assert.equal(err.status, 409);
        const response = err.getResponse();
        assert.equal(response.code, 'EMAIL_IN_USE');
        return true;
      },
    );
  });

  it('6. should validate a valid access token and return user profile', async () => {
    const login = await authService.login({
      email: 'owner1@carsharing.local',
      password: 'DemoPassword123!',
    });

    const user = await authService.validateAccessToken(login.accessToken);
    assert.ok(user, 'User should be found from access token');
    assert.equal(user.id, '00000000-0000-0000-0000-000000000001');
    assert.equal(user.email, 'owner1@carsharing.local');
  });

  it('7. should return null for an invalid or tampered access token', async () => {
    const user = await authService.validateAccessToken('invalid.jwt.token.here');
    assert.equal(user, null);
  });
});
