import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('API_PORT') ?? 4000;
  const corsOrigin = configService.get<string>('CORS_ORIGIN') ?? 'http://localhost:3000';

  // Thiết lập tiền tố toàn cục /api/v1 theo hợp đồng
  app.setGlobalPrefix('api/v1');

  // Bật graceful shutdown hooks
  app.enableShutdownHooks();

  // Cấu hình CORS
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  await app.listen(port);
  logger.log(`Car Sharing API server is running on port ${port} with prefix /api/v1`);
}

void bootstrap();
