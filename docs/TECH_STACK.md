# Ma Trận Công Nghệ và Phiên Bản Tương Thích (Tech Stack)

Tài liệu được thiết lập theo nhiệm vụ **G0-00** (Kế hoạch G0–G5, `docs/tasks/G0_TASKS.md`, `docs/DECISIONS.md`, `docs/GEMINI_HANDOFF.md`).  
Ngày xác minh thực tế: **27/10/2026**.

---

## 1. Kết Quả Xác Minh Môi Trường Thực Tế Trên Máy Host

Các công cụ và dịch vụ đã được kiểm tra trực tiếp qua PowerShell trên máy phát triển:

| Hạng mục | Hiện trạng trên máy | Chi tiết xác minh | Đánh giá |
| --- | --- | --- | --- |
| **Hệ điều hành** | Windows 10 Pro 64-bit | Version 10.0.19045, Build 19045 | Đạt yêu cầu |
| **Shell** | Windows PowerShell | 5.1.19041.6456 (Desktop edition) | Đạt yêu cầu |
| **Git** | Đã cài đặt | `git version 2.56.0.windows.1` | Chưa khởi tạo repo `.git` (dành cho G0-01) |
| **Node.js** | Đã cài đặt | `v24.21.0` (Hỗ trợ đầy đủ runtime và Nest CLI v12) | Đạt yêu cầu |
| **npm** | Đã cài đặt | `11.19.0` | Đạt yêu cầu |
| **Corepack** | Đã cài đặt kèm Node | `0.36.0` | Có sẵn để kích hoạt pnpm |
| **pnpm** | **Chưa cài trong PATH** | Lệnh `pnpm` chưa nhận diện trực tiếp | **Cần kích hoạt** ở G0-01 |
| **Docker** | Đã cài đặt | `Docker version 29.8.0, build 88096ef` | Nhị phân client đã sẵn sàng |
| **Docker Compose** | Đã cài đặt | `Docker Compose version v5.5.1` | Nhị phân đã sẵn sàng |
| **Docker Daemon** | **Chưa chạy** | WSL 2 có distro `docker-desktop` ở trạng thái `Stopped` | **Cần bật Docker Desktop** trước G0-05 |
| **PostgreSQL (Host)**| Đang chạy Service native | Service `postgresql-x64-18` (PostgreSQL 18.6) chạy tại `C:\Program Files\PostgreSQL\18\bin` | Chiếm cổng `5432` |
| **Extension btree_gist**| Đã có sẵn trên host | Thư mục `C:\Program Files\PostgreSQL\18\share\extension` có `btree_gist.control` (v1.0 – v1.8) | Đạt yêu cầu |

### Hiện trạng sử dụng cổng Local (Port Audit)

Kiểm tra trực tiếp qua `Get-NetTCPConnection`:
- **Port 3000** (Next.js Web default): **Trống (FREE)**
- **Port 3001** (Dự phòng Web/API): **Trống (FREE)**
- **Port 4000** (NestJS API default): **Trống (FREE)**
- **Port 5432** (PostgreSQL default): **ĐANG BỊ CHIẾM (IN USE)** bởi tiến trình `postgres` (PID 5544, service native `postgresql-x64-18`)
- **Port 5433** (PostgreSQL dự phòng cho Docker): **Trống (FREE)**
- **Port 9000** (MinIO S3 API): **Trống (FREE)**
- **Port 9001** (MinIO Console Web): **Trống (FREE)**

---

## 2. Công Cụ Còn Thiếu & Phương Án Xử Lý

1. **`pnpm` CLI chưa có trong PATH hệ thống:**
   - *Nguyên nhân:* Môi trường chưa chạy `corepack enable pnpm` hoặc cài global.
   - *Phương án giải quyết ở G0-01:* Người dùng hoặc tác vụ G0-01 có thể chạy `corepack enable pnpm` hoặc `npm install -g pnpm@12.15.0`. Theo nguyên tắc G0-00, không tự ý thay đổi âm thầm môi trường hệ thống.
2. **Docker Daemon chưa khởi động:**
   - *Nguyên nhân:* Ứng dụng Docker Desktop chưa được bật trên Windows.
   - *Phương án giải quyết:* Cần mở Docker Desktop trước khi chạy task **G0-05** (PostgreSQL & Object Storage qua Docker Compose).
3. **Xung đột cổng 5432 với PostgreSQL 18 native:**
   - *Tình huống:* Máy host đang chạy service `postgresql-x64-18` chiếm cổng 5432.
   - *Phương án lựa chọn:*
     - **Lựa chọn 1 (Khuyên dùng cho Docker Compose ở G0-05):** Cấu hình `infra/compose.yaml` ánh xạ cổng host `5433:5432`, tách biệt hoàn toàn dữ liệu container với database của hệ thống.
     - **Lựa chọn 2:** Tạm dừng service Windows (`Stop-Service postgresql-x64-18`) khi cần dùng cổng 5432 cho Docker container.
     - **Lựa chọn 3:** Tận dụng trực tiếp PostgreSQL 18.6 native trên host (đã kiểm tra có sẵn extension `btree_gist`).

---

## 3. Ma Trận Phiên Bản Được Ghim (Pinned Tech Stack)

Dựa trên tài liệu chính thức của từng công nghệ và các quyết định kiến trúc tại `docs/DECISIONS.md`:

| Thành phần | Phiên bản ghim | Yêu cầu runtime / Ràng buộc kỹ thuật | Nguồn tài liệu xác minh |
| --- | --- | --- | --- |
| **Node.js** | **`24.21.0`** (Host) / `>=24.15.0` | Node 24 Maintenance LTS. Thỏa mãn runtime NestJS v12 (`>=22.12` / `>=20.19`) và Nest CLI Schematics (`>=24.15.0`). | [Node.js Releases](https://nodejs.org/en/about/previous-releases), [NestJS CLI Requirements](https://docs.nestjs.com/first-steps) |
| **Package Manager** | **`pnpm 12.15.0`** | Quản lý monorepo workspace (`apps/*`, `packages/*`), strict dependency isolation, tiết kiệm ổ cứng. | [pnpm Documentation](https://pnpm.io/) |
| **TypeScript** | **`~5.8.2`** | `strict: true`, không dùng `any`, không dùng `@ts-ignore`. Thống nhất toàn workspace qua `tsconfig.base.json`. | [TypeScript Handbook](https://www.typescriptlang.org/docs/) |
| **API Backend** | **NestJS `12.2.0`** | `@nestjs/core@12.2.0`, `@nestjs/common@12.2.0`, `@nestjs/platform-express@12.2.0`, `@nestjs/cli@12.0.10`. Modular monolith (ADR-01, ADR-02), tiền tố `/api/v1`, validation qua `class-validator@^0.14.1` và `class-transformer@^0.5.1`. | [NestJS Docs](https://docs.nestjs.com) |
| **Web Frontend** | **Next.js `16.4.3`** | Next.js App Router, React **`19.3.1`**, React DOM **`19.3.1`**. Tích hợp reverse proxy rewrite `/api/v1/:path*` về API Backend cùng origin. | [Next.js Docs](https://nextjs.org/docs), [React 19 Docs](https://react.dev) |
| **Styling** | **Tailwind CSS v4** / Vanilla CSS | Tiện ích CSS hiện đại, responsive breakpoint 360px/768px/desktop, giao diện tiếng Việt nhất quán. | `docs/GEMINI_HANDOFF.md` |
| **ORM / Data Access** | **Prisma `6.19.3`** | `prisma@6.19.3` & `@prisma/client@6.19.3`. Bản phát hành ổn định trưởng thành dòng 6.x theo đúng trích dẫn kỹ thuật tại `docs/DECISIONS.md#ADR-09` (Prisma v6 transaction & exclusion constraints). | [Prisma v6 Documentation](https://www.prisma.io/docs/orm/v6) |
| **Database Engine** | **PostgreSQL `18-alpine`** | PostgreSQL 18 (tương thích hoàn toàn với bản 18.6 native trên host). Hỗ trợ range types `tsrange` và exclusion constraint (`GIST`) chống trùng lịch xe. | [PostgreSQL 18 Docs](https://www.postgresql.org/docs/18/rangetypes.html) |
| **PostgreSQL Extension**| **`btree_gist`** | Bắt buộc để thiết lập `EXCLUDE USING gist (vehicle_id WITH =, period WITH &&)`. Đã kiểm tra sẵn có trong PostgreSQL 18. | `docs/DECISIONS.md#ADR-10`, `docs/DATABASE_DESIGN.md` |
| **Object Storage** | **Silo / MinIO (`pgsty/silo:latest`)** | Image: `pgsty/silo:latest` (drop-in replacement mã nguồn mở cho MinIO official image đã bị hạn chế trên Docker Hub/Quay). S3-compatible, quản lý bucket private, cấp presigned URL upload/view. | [Silo Repository](https://github.com/pgsty/silo) |
| **Storage SDK** | **`@aws-sdk/client-s3@^3.700.0`** | `@aws-sdk/s3-request-presigner@^3.700.0`. Giao diện S3 tiêu chuẩn cho cả MinIO/Silo local và AWS S3 production. | [AWS SDK for JS v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/) |
| **Testing** | **Node.js Test Runner & Playwright** | Node.js built-in test runner (`node --test`) cho NestJS unit, integration và e2e; Playwright (`@playwright/test@^1.64.1`) cho smoke test trình duyệt Chromium. | `docs/tasks/G0_TASKS.md#G0-11` |

---

## 4. Ràng Buộc & Tính Nhất Quán Kiến Trúc

1. **Không giả mạo kết quả build/test:** Không tạo stub shell hay script exit 0 giả lập kiểm thử.
2. **Không phá vỡ hợp đồng dữ liệu:**
   - Lịch xe là nửa đóng nửa mở `[startAt, endAt)` tính theo UTC.
   - Không kiểm tra lịch bằng mã ứng dụng thông thường rồi mới insert; bắt buộc ràng buộc exclusion cấp DB PostgreSQL.
   - Tiền tệ nguyên VND, ceil theo 24 giờ.
3. **Phân chia gói Workspace dự kiến ở G0-01:**
   - `apps/web`: Next.js 16 + React 19.
   - `apps/api`: NestJS 12 modular monolith.
   - `packages/contracts`: Types, DTOs chia sẻ và OpenAPI schema client.
   - `packages/config`: Cấu hình tsconfig, eslint chung.

---

## 5. Bước Tiếp Theo

Chuyển sang thực hiện **G0-01 Khởi tạo workspace và baseline** khi có lệnh từ người dùng:
- Kích hoạt / cấu hình `pnpm` workspace (`pnpm-workspace.yaml`, `package.json`).
- Khởi tạo Git repository (`git init`) và cấu hình `.gitignore`.
- Thiết lập `tsconfig.base.json` với TypeScript strict mode.
- Thiết lập file `.env.example` với đầy đủ các biến môi trường cấu hình (không chứa secret thật).
