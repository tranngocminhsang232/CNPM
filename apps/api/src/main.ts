import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter, TransformInterceptor } from './common';

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

  // Cấu hình ValidationPipe toàn cục
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Cấu hình Response Transform Interceptor ({ data, meta? })
  app.useGlobalInterceptors(new TransformInterceptor());

  // Cấu hình Global Exception Filter ({ error, requestId })
  app.useGlobalFilters(new HttpExceptionFilter());

  // Cấu hình CORS
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  await app.listen(port);
  logger.log(`Car Sharing API server is running on port ${port} with prefix /api/v1`);
}

void bootstrap();
