import { createRequire } from 'node:module';
import * as path from 'node:path';
import * as fs from 'node:fs';

const require = createRequire(import.meta.url);

async function run() {
  const { NestFactory } = require('../apps/api/node_modules/@nestjs/core');
  const { SwaggerModule, DocumentBuilder } = require('../apps/api/node_modules/@nestjs/swagger');

  const appModulePath = fs.existsSync(path.resolve('apps/api/dist/app.module.js'))
    ? path.resolve('apps/api/dist/app.module.js')
    : path.resolve('apps/api/dist/src/app.module.js');

  const { AppModule } = require(appModulePath);

  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');

  const config = new DocumentBuilder()
    .setTitle('Car Sharing Platform API')
    .setDescription('Nền tảng chia sẻ xe tự lái (Car Sharing MVP) - API Contract v1.1')
    .setVersion('1.0')
    .addTag('Health', 'Kiểm tra trạng thái liveness & readiness của hệ thống')
    .addTag('Vehicles', 'Tìm kiếm xe và danh mục tùy chọn công khai')
    .addTag('Auth', 'Xác thực, phân quyền và quản lý phiên người dùng')
    .addTag('Users', 'Hồ sơ người dùng và xác thực giấy phép lái xe (KYC)')
    .addTag('Pricing', 'Động cơ tính toán biểu phí thuê xe')
    .addTag('Promotions', 'Quản lý và áp dụng mã khuyến mãi')
    .addTag('Bookings', 'Quản lý yêu cầu đặt xe, duyệt, từ chối và vòng đời chuyến đi')
    .addTag('Payments', 'Cổng thanh toán sandbox, ký số HMAC-SHA512 và ký quỹ chuyến đi')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const outDir = path.resolve('packages/contracts');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, 'openapi.json');
  fs.writeFileSync(outPath, JSON.stringify(document, null, 2), 'utf-8');
  console.log(`✓ OpenAPI specification successfully exported to ${outPath}`);

  await app.close();
  process.exit(0);
}

run().catch((err) => {
  console.error('Failed to export OpenAPI spec:', err);
  process.exit(1);
});
