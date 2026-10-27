import { Controller, Get } from '@nestjs/common';

export interface HealthCheckData {
  status: 'ok';
  timestamp: string;
  uptime: number;
}

export interface HealthCheckResponse {
  data: HealthCheckData;
}

@Controller('health')
export class HealthController {
  @Get()
  check(): HealthCheckResponse {
    return {
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
      },
    };
  }
}
