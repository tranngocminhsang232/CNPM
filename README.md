# Car Sharing và Keyless Rental

Dự án Nhóm 7 theo Topic 18. Trạng thái hiện tại: Đã hoàn thành baseline G0 (PostgreSQL 18, MinIO/Silo, NestJS 12, Next.js 16, OpenAPI contracts, seed idempotent, suite test kiểm tra toàn diện và Playwright browser smoke test).

- [Kế hoạch xây dựng web](docs/IMPLEMENTATION_PLAN.md)
- [SRS phiên bản 1.1](docs/SRS.md)
- [Quyết định nghiệp vụ và kiến trúc](docs/DECISIONS.md)
- [Hợp đồng API](docs/API_CONTRACT.md)
- [Thiết kế CSDL](docs/DATABASE_DESIGN.md)
- [Nhật ký sửa tài liệu](docs/CHANGELOG_REVIEW.md)
- [Bàn giao cho Gemini và prompt khởi động](docs/GEMINI_HANDOFF.md)
- [Task cards triển khai G0](docs/tasks/G0_TASKS.md)
- [Tiến độ theo từng task](docs/PROGRESS.md)

Ba báo cáo Word ở thư mục gốc được cập nhật theo cùng quyết định. Bản gốc trước sửa nằm trong backups/2026-10-27-originals.

## Lệnh Vận Hành và Kiểm Tra Workspace

```bash
# 1. Cài đặt dependencies (yêu cầu Node.js >= 24 và pnpm >= 12)
pnpm install

# 2. Sinh Prisma Client & triển khai migration CSDL
pnpm exec prisma migrate deploy
pnpm db:seed

# 3. Kiểm tra kiểu tĩnh toàn bộ workspace
pnpm run typecheck

# 4. Kiểm tra quy tắc định dạng code (Prettier)
pnpm run format:check
pnpm run format

# 5. Biên dịch toàn bộ packages (contracts, api, web)
pnpm run build

# 6. Chạy toàn bộ test suites backend (49 tests: unit, integration constraints, e2e)
pnpm run test

# 7. Chạy Playwright browser smoke test (khởi chạy tự động API và Web qua Chromium)
pnpm run test:smoke

# 8. Khởi chạy môi trường phát triển local
pnpm --filter @carsharing/api run start:dev  # Backend API tại http://localhost:4000
pnpm --filter @carsharing/web run dev        # Web Frontend tại http://localhost:3000
```

## Hướng dẫn Khởi chạy Môi trường Hạ tầng Local (Docker Compose)

Hạ tầng lưu trữ và cơ sở dữ liệu được định nghĩa tại `infra/compose.yaml`:

- **PostgreSQL 18** (Alpine): Host port `5433` (tránh xung đột với PostgreSQL host port 5432).
  - Dev Database: `carsharing_dev` (có sẵn extension `btree_gist`)
  - Test Database: `carsharing_test` (có sẵn extension `btree_gist`)
  - User / Password: `carsharing` / `carsharing_local_password`
- **S3-compatible Storage (MinIO / Silo)**:
  - S3 API: `http://localhost:9000`
  - MinIO Console: `http://localhost:9001` (User: `minioadmin`, Pass: `minioadmin`)
  - Private Bucket: `car-sharing-private` (anonymous: none, chỉ truy cập qua signed URL hoặc S3 credentials)

### Các lệnh quản trị hạ tầng (Bảo toàn dữ liệu Volumes):

```bash
# Khởi động dịch vụ nền (giữ nguyên volume dữ liệu):
docker compose -f infra/compose.yaml up -d

# Tạm dừng dịch vụ (KHÔNG xóa volume):
docker compose -f infra/compose.yaml stop

# Khởi động lại dịch vụ đã dừng:
docker compose -f infra/compose.yaml start

# Tắt và dỡ bỏ container nhưng GIỮ NGUYÊN volume dữ liệu:
docker compose -f infra/compose.yaml down

# CẢNH BÁO: Chỉ thêm cờ -v khi muốn XÓA HOÀN TOÀN toàn bộ database và bucket local:
# docker compose -f infra/compose.yaml down -v
```
