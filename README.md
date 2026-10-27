# Car Sharing và Keyless Rental

Dự án Nhóm 7 theo Topic 18. **Trạng thái hiện tại: Đã hoàn thành 100% toàn diện toàn bộ các Milestones từ G0 đến G5 (37/37 tasks DONE)**, bao gồm toàn bộ chức năng Web UI (Next.js 16 Turbopack), API (NestJS Modular Monolith), cơ sở dữ liệu (PostgreSQL 18 & Prisma), lưu trữ ảnh (MinIO S3 Presigned URL), mô phỏng viễn thông khóa ảo Keyless và bộ test kiểm thử tự động toàn diện.

- [Tiến độ theo từng task (PROGRESS.md)](docs/PROGRESS.md)
- [Bảng ma trận kiểm chứng & nghiệm thu (VERIFICATION.md)](docs/VERIFICATION.md)
- [SRS phiên bản 1.1](docs/SRS.md)
- [Quyết định nghiệp vụ và kiến trúc (DECISIONS.md)](docs/DECISIONS.md)
- [Hợp đồng API (API_CONTRACT.md)](docs/API_CONTRACT.md)
- [Thiết kế CSDL (DATABASE_DESIGN.md)](docs/DATABASE_DESIGN.md)
- [Kế hoạch triển khai tổng thể G0–G5](docs/IMPLEMENTATION_PLAN.md)
- [Task cards triển khai G0 (Baseline)](docs/tasks/G0_TASKS.md)
- [Task cards triển khai G1 (Auth, KYC & Quản lý xe)](docs/tasks/G1_TASKS.md)
- [Task cards triển khai G2 (Tìm kiếm xe & Động cơ tính giá)](docs/tasks/G2_TASKS.md)
- [Task cards triển khai G3 (Quy trình đặt xe & Thanh toán)](docs/tasks/G3_TASKS.md)
- [Task cards triển khai G4 (Bàn giao xe & Khóa ảo Keyless)](docs/tasks/G4_TASKS.md)
- [Task cards triển khai G5 (Trả xe, Quyết toán, Đánh giá & Dashboard)](docs/tasks/G5_TASKS.md)

Ba báo cáo Word ở thư mục gốc được cập nhật và đồng bộ theo cùng quyết định. Bản gốc trước sửa nằm trong `backups/2026-10-27-originals`.

## Lệnh Vận Hành và Kiểm Tra Workspace

```bash
# 1. Cài đặt dependencies (yêu cầu Node.js >= 24 và pnpm >= 10)
pnpm install

# 2. Sinh Prisma Client & triển khai migration CSDL
pnpm exec prisma migrate deploy
pnpm db:seed

# 3. Kiểm tra kiểu tĩnh toàn bộ workspace (3 packages)
pnpm run typecheck

# 4. Kiểm tra và chuẩn hóa quy tắc định dạng code (Prettier)
pnpm run format:check
pnpm run format

# 5. Biên dịch toàn bộ packages (contracts, api, web)
pnpm run build

# 6. Kiểm tra an ninh tự động (secrets, HttpOnly cookies, CSRF, PII masking)
pnpm run test:security

# 7. Chạy unit tests backend (149 test cases pass 100%)
pnpm run test

# 8. Chạy Playwright browser smoke tests (6 suites trên Chromium)
pnpm run test:smoke

# 9. Khởi chạy môi trường phát triển local
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
