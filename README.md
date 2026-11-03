# Car Sharing & Keyless Rental Platform

Nền tảng chia sẻ và cho thuê xe tự lái trực tuyến với công nghệ nhận xe qua khóa ảo không tiếp xúc (Keyless Rental).

Hệ thống được thiết kế theo kiến trúc **Monorepo** với đầy đủ các phân hệ từ Web Frontend, Backend API, Cơ sở dữ liệu quan hệ, Lưu trữ tệp tin S3 và Bộ kiểm thử tự động toàn diện.

---

## 🏗️ Kiến trúc Hệ thống (Monorepo)

```text
├── apps/
│   ├── web/           # Frontend: Next.js 16 (App Router, Turbopack, React 19, Tailwind CSS)
│   └── api/           # Backend: NestJS 11 (Modular Monolith, RESTful API, Swagger/OpenAPI)
├── packages/
│   └── contracts/     # DTO Contracts & OpenAPI Type Definitions dùng chung
├── prisma/            # Schema CSDL, Migrations PostgreSQL và Seed dữ liệu mẫu
├── infra/             # Docker Compose (PostgreSQL 18 & MinIO S3 Storage)
├── tools/             # Script hỗ trợ sinh OpenAPI contract và nạp dữ liệu ảnh
└── *.bat              # Kịch bản khởi chạy tự động 1-click dành cho Windows
```

---

## 🚀 Các Tính Năng Chính Của Hệ Thống

1. **Xác thực & Năng lực kép (Capability Model):**
   - Đăng nhập qua Email/Mật khẩu và Google OIDC.
   - Phiên bảo mật Cookie `HttpOnly`, phòng thủ CSRF Token gắn phiên (`X-CSRF-Token`).
   - Một tài khoản duy nhất có thể vừa thuê xe (Renter) vừa cho thuê xe của mình (Owner).
2. **Xác thực Bằng lái xe (KYC GPLX Flow):**
   - Định dạng chuẩn 12 số của Bộ GTVT, kiểm tra độ tuổi $\ge 18$, hạn bằng lái $\ge 30$ ngày.
   - Guard `KycVerifiedGuard` bảo vệ chốt chặn đặt xe, yêu cầu xác thực bằng lái trước khi thuê.
3. **Quản lý Phương tiện Dành cho Chủ xe (Owner Dashboard & Fleet):**
   - Đăng ký xe mới, tải ảnh xe, định giá theo ngày.
   - Quản lý trạng thái xe (`DRAFT`, `PUBLISHED`, `ARCHIVED`).
   - Quản lý lịch xe: Chặn lịch bảo dưỡng / bận cá nhân (`OWNER_BLOCK`), chống xung đột lịch.
4. **Tìm kiếm & Lọc xe Thông minh:**
   - Lọc theo thành phố, khoảng thời gian thuê, loại xe (Sedan, SUV, Crossover...), hộp số (Tự động/Số sàn), số chỗ ngồi và các tiện nghi (GPS, Camera hành trình, Ghế trẻ em...).
   - Sắp xếp theo giá, độ phổ biến, điểm đánh giá trung bình.
5. **Động cơ Tính giá & Voucher Khuyến mãi:**
   - Báo giá thời gian thực (`POST /pricing/quote`).
   - Tự động cộng phụ phí cao điểm cuối tuần (10%), hỗ trợ 3 gói bảo hiểm (Basic, Standard, Premium).
   - Áp dụng mã giảm giá voucher (`WELCOME2026`, `CARSHARE50K`, `VIPSUMMER`).
6. **Quy trình Đặt xe & Vòng đời Chuyến đi (Booking Lifecycle):**
   - Chống tự thuê xe của chính mình (`SELF_BOOKING_FORBIDDEN`).
   - Khóa lịch giữ chỗ nguyên tử bằng PostgreSQL Range Exclusion Constraint (`tstzrange` GiST).
   - Hỗ trợ cơ chế Idempotency với `Idempotency-Key` và SHA-256 request hash chống trùng lặp đơn.
   - Quy trình duyệt / từ chối / hủy đơn chặt chẽ có audit log.
7. **Cổng thanh toán Mô phỏng (Payment Gateway Sandbox & Escrow):**
   - Hỗ trợ thanh toán tiền thuê (`RENTAL_FEE`) và tiền đặt cọc (`DEPOSIT`).
   - Giữ cọc an toàn (Escrow) trong suốt thời gian chuyến đi diễn ra.
8. **Bàn giao & Nhận xe Tự phục vụ (Keyless Remote Control):**
   - Checklist kiểm tra xe trước chuyến (Check-in Inspection): Chụp ảnh 4 góc xe, ghi nhận số ODO và lượng nhiên liệu/pin.
   - Điều khiển mở khóa / khóa xe từ xa (Keyless Remote) dành riêng cho người thuê trong khung giờ đặt.
9. **Trả xe & Quyết toán Cọc (Return Inspection & Deposit Settlement):**
   - Checklist kiểm tra xe sau chuyến (Check-out Inspection).
   - Chủ xe kiểm tra tình trạng xe, đề xuất cấn trừ phụ phí xăng / hư hại (nếu có) và hoàn cọc tự động cho khách.
10. **Đánh giá Hai chiều & Bảng Thống kê (Two-Way Reviews & Dashboard):**
    - Khách thuê đánh giá chất lượng xe & chủ xe; Chủ xe đánh giá ý thức của người thuê.
    - Dashboard chủ xe thống kê doanh thu, tỷ lệ lấp đầy lịch và tổng số lượt thuê.

---

## ⚡ Hướng Dẫn Khởi Chạy Nhanh 1-Click (Windows)

Dự án đã tích hợp sẵn các kịch bản tự động hóa ở thư mục gốc:

- **`start-dev.bat`**: Tự động bật Docker Desktop, khởi động PostgreSQL & MinIO, đồng bộ CSDL, chạy Backend + Frontend và tự động mở trình duyệt tại `http://localhost:3000`.
- **`stop-dev.bat`**: Dừng an toàn toàn bộ Backend, Frontend và Docker containers.
- **`start-studio.bat`**: Mở giao diện đồ họa quản trị CSDL (Prisma Studio) tại `http://localhost:5555`.
- **`reset-db.bat`**: Khôi phục CSDL về trạng thái dữ liệu mẫu ban đầu (4 tài khoản Demo, 13 xe).

---

## 💻 Hướng Dẫn Khởi Chạy Thủ Công (Terminal)

### 1. Yêu cầu môi trường

- **Node.js**: Phiên bản `>= 24.0.0`
- **pnpm**: Phiên bản `>= 10.0.0`
- **Docker Desktop**: Đang chạy

### 2. Cài đặt và chuẩn bị

```bash
# Cài đặt toàn bộ dependencies cho monorepo
pnpm install

# Khởi động cơ sở dữ liệu PostgreSQL (port 5433) và MinIO S3 (port 9000/9001)
docker compose -f infra/compose.yaml up -d

# Đồng bộ schema CSDL và nạp dữ liệu mẫu ban đầu
pnpm exec prisma migrate deploy
pnpm db:seed
```

### 3. Khởi chạy ứng dụng

```bash
# Khởi chạy đồng thời cả Backend và Frontend
pnpm run dev

# Hoặc khởi chạy riêng từng phân hệ:
pnpm --filter @carsharing/api run start:dev  # API Backend tại http://localhost:4000 (Swagger: /api/v1/docs)
pnpm --filter @carsharing/web run dev        # Web Frontend tại http://localhost:3000
```

---

## 🔑 Tài Khoản Thử Nghiệm Có Sẵn (Demo Accounts)

Hệ thống đã chuẩn bị sẵn 4 tài khoản thử nghiệm với mật khẩu chung là `DemoPassword123!` (hoặc sử dụng nút **Đăng nhập nhanh 1-click** ngay trên giao diện Web):

| Vai trò thử nghiệm        | Họ và tên        | Email đăng nhập            | Trạng thái KYC            |
| :------------------------ | :--------------- | :------------------------- | :------------------------ |
| **Khách thuê 1 (Renter)** | Lê Hoàng Thuê 1  | `renter1@carsharing.local` | Đã xác thực (VERIFIED)    |
| **Khách thuê 2 (Renter)** | Phạm Minh Thuê 2 | `renter2@carsharing.local` | Chưa xác thực (NONE)      |
| **Chủ xe 1 (Owner)**      | Nguyễn Văn Chủ 1 | `owner1@carsharing.local`  | Đã xác thực (Sở hữu 6 xe) |
| **Chủ xe 2 (Owner)**      | Trần Thị Chủ 2   | `owner2@carsharing.local`  | Đã xác thực (Sở hữu 6 xe) |

---

## 🧪 Kiểm Thử Hệ Thống (Testing)

```bash
# Kiểm tra kiểu dữ liệu tĩnh TypeScript toàn bộ workspace
pnpm run typecheck

# Chạy toàn bộ 149 Unit tests backend
pnpm run test

# Chạy bộ kiểm thử tự động trên trình duyệt Chromium (Playwright E2E)
pnpm run test:smoke

# Kiểm tra an ninh (phòng thủ CSRF, HttpOnly cookies, phân quyền truy cập)
pnpm run test:security
```
