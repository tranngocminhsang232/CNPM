# Task Cards Milestone G2: Tìm Kiếm Nâng Cao & Động Cơ Tính Giá (Pricing Engine)

Chi tiết các task thuộc Milestone G2 theo SRS 1.1, UC-03 (Tìm kiếm xe) và UC-04 (Tính giá & xem chi tiết).

---

## G2-01: Bộ Lọc & Tìm Kiếm Xe Nâng Cao (Search & Filter Engine)

```text
Mã: G2-01
Tên: Bộ Lọc & Tìm Kiếm Xe Nâng Cao (Search & Filter Engine)
Mục tiêu: Mở rộng GET /api/v1/vehicles hỗ trợ lọc đa tiêu chí linh hoạt: truyền động (Số tự động/Số sàn), loại nhiên liệu (Xăng, Dầu, Điện), khoảng giá (minPrice, maxPrice), số chỗ ngồi (seats), sắp xếp đa chiều (giá tăng/giảm, đánh giá rating, số chuyến đi) và kiểm tra lịch bận chính xác.
Prerequisite đã DONE: G1-06
File cần đọc:
- apps/api/src/vehicles/vehicles.controller.ts
- apps/api/src/vehicles/vehicles.service.ts
- apps/api/src/vehicles/dto/vehicle-query.dto.ts
- prisma/schema.prisma
File chính dự kiến:
- apps/api/src/vehicles/dto/vehicle-query.dto.ts
- apps/api/src/vehicles/vehicles.service.ts
- apps/api/src/vehicles/vehicles.controller.ts
- apps/api/src/vehicles/vehicles.service.spec.ts
- apps/api/test/vehicles-search.e2e-spec.ts
File liên quan bắt buộc:
- packages/contracts/openapi.json
- packages/contracts/src/schema.ts
Kết quả cần có:
- Query DTO mở rộng: minPrice, maxPrice, transmission, fuelType, seats, sortBy ('PRICE_ASC', 'PRICE_DESC', 'RATING_DESC', 'POPULARITY_DESC').
- Service xây dựng Prisma where clause động, kết hợp kiểm tra lịch xe vehicle_calendar loại trừ các xe đã có lịch trùng với khoảng [startAt, endAt).
- Giữ vững quy tắc bảo mật: Không rò rỉ plateNormalized và pickupAddress trong kết quả tìm kiếm công khai.
- Đầy đủ unit tests và e2e tests cho tất cả các bộ lọc và sắp xếp.
Không mở rộng sang: Không tính toán giá khuyến mãi chi tiết (thuộc G2-02 & G2-03).
Ca kiểm tra và expected:
- GET /vehicles?minPrice=800000&maxPrice=1200000 -> chỉ trả về xe có pricePerDayVnd trong khoảng.
- GET /vehicles?transmission=AUTOMATIC&seats=7 -> chỉ trả về xe số tự động 7 chỗ.
- GET /vehicles?sortBy=PRICE_ASC -> danh sách xe sắp xếp tăng dần theo giá thuê.
- GET /vehicles?startAt=...&endAt=... -> loại trừ chính xác xe có lịch trùng.
Lệnh kiểm tra thực tế:
- pnpm --filter @carsharing/api test
- pnpm --filter @carsharing/api test:e2e
Điều kiện DONE: Đạt 100% tests mới và cũ, xuất OpenAPI và cập nhật schema hợp đồng.
```

---

## G2-02: Động Cơ Tính Giá & Snapshot Chi Phí Thuê Xe (Pricing Engine & Breakdown)

```text
Mã: G2-02
Tên: Động Cơ Tính Giá & Snapshot Chi Phí Thuê Xe (Pricing Engine & Breakdown)
Mục tiêu: Hiện thực hóa logic nghiệp vụ UC-04: Tính toán chi tiết biểu phí thuê xe dựa trên số ngày thuê, phụ phí cuối tuần/lễ tết (peak surcharge), gói bảo hiểm thuê xe (Cơ bản, Tiêu chuẩn, Nâng cao), phí dịch vụ nền tảng (10%), và tiền đặt cọc (deposit). Cung cấp endpoint POST /api/v1/pricing/calculate và GET /api/v1/vehicles/:id/pricing-preview.
Prerequisite đã DONE: G2-01
File cần đọc:
- docs/PRICING_MODEL.md hoặc SRS 1.1 phần UC-04
- prisma/schema.prisma (bảng pricing_snapshots, insurance_packages)
File chính dự kiến:
- apps/api/src/pricing/pricing.module.ts
- apps/api/src/pricing/pricing.service.ts
- apps/api/src/pricing/pricing.controller.ts
- apps/api/src/pricing/dto/calculate-pricing.dto.ts
- apps/api/src/pricing/pricing.service.spec.ts
- apps/api/test/pricing.e2e-spec.ts
File liên quan bắt buộc:
- apps/api/src/app.module.ts
- packages/contracts/openapi.json
- packages/contracts/src/schema.ts
Kết quả cần có:
- PricingService tính toán số ngày thuê làm tròn theo block 24h hoặc bán ngày theo quy định.
- Công thức chuẩn:
  - Base rent = pricePerDayVnd * days
  - Peak surcharge (nếu rơi vào thứ 7, CN hoặc ngày lễ)
  - Insurance fee theo gói được chọn
  - Service fee = 10% * (Base rent + Peak surcharge)
  - Deposit = theo quy định dòng xe (5.000.000 đến 15.000.000 VND)
  - Subtotal = Base rent + Peak surcharge + Insurance fee
  - Total = Subtotal + Service fee + Deposit
- Kiểm tra toàn vẹn toán học: Subtotal + Service fee + Deposit == Total (khớp với check constraint PostgreSQL của bảng pricing_snapshots).
- Unit tests bao phủ mọi trường hợp biên: thuê 1 ngày, thuê nhiều ngày, cuối tuần, ngày lễ.
Không mở rộng sang: Không tạo bản ghi booking chính thức (thuộc Milestone G3).
Ca kiểm tra và expected:
- POST /pricing/calculate với xe 1.000.000 VND/ngày, thuê 2 ngày ngày thường -> base 2.000.000, service 200.000, deposit đúng quy định, total khớp 100%.
- POST /pricing/calculate rơi vào cuối tuần -> áp dụng phụ phí cuối tuần.
- Lựa chọn gói bảo hiểm nâng cao -> cộng phí bảo hiểm vào subtotal.
Lệnh kiểm tra thực tế:
- pnpm --filter @carsharing/api test
- pnpm --filter @carsharing/api test:e2e
Điều kiện DONE: Toàn bộ kiểm thử unit/e2e tính giá đạt chuẩn, không có lỗi làm tròn số tiền (toàn bộ tính toán dùng số nguyên integer VND).
```

---

## G2-03: Hệ Thống Mã Khuyến Mãi & Giảm Giá (Promotion & Voucher Engine)

```text
Mã: G2-03
Tên: Hệ Thống Mã Khuyến Mãi & Giảm Giá (Promotion & Voucher Engine)
Mục tiêu: Xây dựng dịch vụ quản lý và áp dụng mã giảm giá (voucher/promotion) vào động cơ tính giá: kiểm tra tính hợp lệ của mã, hạn sử dụng, số lượt dùng tối đa, giá trị đơn hàng tối thiểu, mức giảm (theo % có trần tối đa hoặc số tiền cố định VND).
Prerequisite đã DONE: G2-02
File cần đọc:
- prisma/schema.prisma (bảng promotions, promotion_usages)
- apps/api/src/pricing/pricing.service.ts
File chính dự kiến:
- apps/api/src/promotions/promotions.module.ts
- apps/api/src/promotions/promotions.service.ts
- apps/api/src/promotions/promotions.controller.ts
- apps/api/src/promotions/dto/apply-promotion.dto.ts
- apps/api/src/promotions/promotions.service.spec.ts
- apps/api/test/promotions.e2e-spec.ts
File liên quan bắt buộc:
- apps/api/src/pricing/pricing.service.ts
- packages/contracts/openapi.json
- packages/contracts/src/schema.ts
Kết quả cần có:
- Endpoint POST /api/v1/promotions/validate kiểm tra mã giảm giá với context đơn thuê cụ thể.
- Tích hợp vào PricingService: trừ số tiền giảm discountAmountVnd vào subtotal trước khi tính phí dịch vụ.
- Đảm bảo các ràng buộc: Mã hết hạn -> lỗi 400 EXPIRED_PROMOTION; vượt quá lượt dùng -> lỗi 400 PROMOTION_USAGE_EXCEEDED; chưa đạt giá trị tối thiểu -> 400 MINIMUM_ORDER_NOT_MET.
- Số tiền giảm không bao giờ vượt quá Subtotal hoặc giá trị tối đa maxDiscountVnd.
Không mở rộng sang: Không trừ lượt dùng voucher vĩnh viễn trước khi booking thanh toán thành công.
Ca kiểm tra và expected:
- Nộp mã giảm 10% tối đa 200k cho đơn 1.5M -> giảm đúng 150.000 VND.
- Nộp mã giảm 10% tối đa 200k cho đơn 3M -> giảm đúng 200.000 VND (chạm trần maxDiscount).
- Nộp mã không tồn tại -> 404 NOT_FOUND.
- Nộp mã hết hạn -> 400 VALIDATION_ERROR.
Lệnh kiểm tra thực tế:
- pnpm --filter @carsharing/api test
- pnpm --filter @carsharing/api test:e2e
Điều kiện DONE: Unit và E2E tests pass 100%, không cho phép giảm âm tiền.
```

---

## G2-04: Giao Diện Web Chi Tiết Xe & Bảng Dự Toán Chi Phí Tương Tác (Vehicle Details & Price Preview UI)

```text
Mã: G2-04
Tên: Giao Diện Web Chi Tiết Xe & Bảng Dự Toán Chi Phí Tương Tác (Vehicle Details & Price Preview UI)
Mục tiêu: Xây dựng trang chi tiết xe `/vehicles/[id]` hoàn chỉnh: thư viện hình ảnh thực tế, thông số kỹ thuật (động cơ, số chỗ, truyền động, mức tiêu thụ, năm sản xuất), danh mục tiện nghi, hồ sơ đánh giá chủ xe, bộ chọn ngày giờ thuê tương tác [startAt, endAt), bộ chọn gói bảo hiểm, ô nhập mã khuyến mãi, và bảng dự toán chi phí chi tiết (bóc tách từng khoản: tiền thuê, phụ phí, bảo hiểm, phí dịch vụ, cọc, tổng cộng).
Prerequisite đã DONE: G2-03
File cần đọc:
- apps/web/src/lib/api.ts
- apps/web/src/components/VehicleCard.tsx
- packages/contracts/src/schema.ts
File chính dự kiến:
- apps/web/src/app/vehicles/[id]/page.tsx
- apps/web/src/components/PricingCalculator.tsx
- apps/web/src/components/VehicleGallery.tsx
- apps/web/src/lib/api.ts
- apps/web/test/vehicle-details-pricing.spec.ts
File liên quan bắt buộc:
- apps/web/src/components/FilterBar.tsx
- apps/web/src/app/page.tsx
Kết quả cần có:
- Trang `/vehicles/[id]` tải dữ liệu xe từ backend qua API.
- Hiển thị đầy đủ gallery ảnh từ MinIO S3 presigned URLs.
- Bảng chọn thời gian thuê tự động gọi API `calculatePricing` để tính biểu phí thời gian thực.
- Cho phép người dùng nhập mã voucher và cập nhật lại bảng giá ngay lập tức.
- Nút "Tiến hành đặt xe" kích hoạt xác thực: nếu chưa đăng nhập -> mở modal đăng nhập; nếu chưa xác thực GPLX -> cảnh báo nhắc nhở KYC.
- Đảm bảo thiết kế thẩm mỹ cao, phong cách hiện đại, responsive trên cả desktop và mobile.
Không mở rộng sang: Không xử lý luồng thanh toán VNPay thật (thuộc Milestone G3).
Ca kiểm tra và expected:
- Truy cập /vehicles/[id] với xe từ seed -> hiển thị đầy đủ thông tin, gallery ảnh, thông số.
- Thay đổi ngày giờ thuê -> bảng dự toán chi phí cập nhật số ngày và tổng tiền chính xác.
- Nhập mã giảm giá hợp lệ -> bảng giá hiển thị dòng giảm giá và số tiền trừ tương ứng.
- Playwright browser test bao phủ toàn bộ luồng tương tác trên trang chi tiết xe.
Lệnh kiểm tra thực tế:
- pnpm --filter @carsharing/web build
- pnpm --filter @carsharing/web exec playwright test test/vehicle-details-pricing.spec.ts
Điều kiện DONE: Next.js build không lỗi, Playwright test pass 100%.
```

---

## G2-05: Đóng Gói, Kiểm Thử Tích Hợp Toàn Diện & Kế Hoạch Milestone G3 (Booking & Payment)

```text
Mã: G2-05
Tên: Đóng Gói, Kiểm Thử Tích Hợp Toàn Diện & Kế Hoạch Milestone G3 (Booking & Payment)
Mục tiêu: Chạy toàn bộ pipeline kiểm thử (unit, integration constraints, e2e API, browser smoke & feature tests), kiểm tra bảo mật, typecheck, format check, cập nhật nhật ký tiến độ PROGRESS.md và lập danh sách task cards cho Milestone G3 (Quy trình Đặt Xe, Cọc & Thanh Toán).
Prerequisite đã DONE: G2-01 đến G2-04
File cần đọc:
- docs/PROGRESS.md
- package.json
File chính dự kiến:
- docs/PROGRESS.md
- docs/tasks/G3_TASKS.md
File liên quan bắt buộc:
- apps/web/test/*
- apps/api/test/*
Kết quả cần có:
- Toàn bộ test suite xanh 100%: Unit tests, DB constraint tests, E2E API tests, Playwright browser tests.
- Không có lỗi typecheck hay format.
- Lập bộ task cards Milestone G3 chi tiết:
  - G3-01: Luồng Đặt Xe & Quản Lý Vòng Đời Đơn Thuê (UC-05 Booking Lifecycle & State Machine).
  - G3-02: Tích Hợp Cổng Thanh Toán & Đặt Cọc Giữ Chỗ (UC-06 Payment Gateway & Deposit Escrow).
  - G3-03: Web UI Luồng Đặt Xe, Thanh Toán & Quản Lý Chuyến Đi.
  - G3-04: Đóng Gói Milestone G3.
Lệnh kiểm tra thực tế:
- pnpm run typecheck
- pnpm run build
- pnpm run test
- pnpm run test:smoke
- pnpm run format:check
Điều kiện DONE: Pipeline hoàn chỉnh, tài liệu cập nhật chi tiết.
```
