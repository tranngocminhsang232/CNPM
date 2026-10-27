# Car Sharing và Keyless Rental

Dự án Nhóm 7 theo Topic 18. Trạng thái hiện tại: chuẩn bị đặc tả và kế hoạch; chưa có source ứng dụng chạy được.

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

Bước triển khai tiếp theo là G0: tạo Next.js/NestJS workspace, môi trường PostgreSQL/object storage, migration, seed và vertical slice danh sách xe.

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

