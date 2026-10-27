import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface HealthCheckData {
  status: 'ok';
  timestamp: string;
  uptime: number;
  database: 'connected';
}

export interface HealthCheckResponse {
  data: HealthCheckData;
}

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<HealthCheckResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        code: 'DATABASE_DISCONNECTED',
        message: 'Database connection failed',
      });
    }

    return {
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        database: 'connected',
      },
    };
  }
}
