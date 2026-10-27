# Kế hoạch công việc Milestone G5: Trả Xe, Quyết Toán Ký Quỹ, Đánh Giá Hai Chiều & Bảng Điều Khiển Chủ Xe

Tài liệu chi tiết các task thuộc Milestone G5.
Phiên bản: 1.0 (27/10/2026).
Dựa trên SRS 1.1, BR-08, BR-10, BR-12, BR-13, REQ-CAR-05, REQ-CAR-06, REQ-CAR-07.

---

## Danh sách Tasks Milestone G5

| Mã | Tên Task | Phụ trách chính | Trạng thái |
| --- | --- | --- | --- |
| G5-01 | Quy trình Trả xe, Checklist 4 Góc Sau Chuyến & Hoàn tất Chuyến đi | Backend (Triệu Minh Trí) | DONE |
| G5-02 | Quyết toán Ký quỹ & Xử lý Hoàn cọc / Phụ phí phát sinh | Backend (Triệu Minh Trí / Đinh Hoàng Việt) | DONE |
| G5-03 | Động cơ Đánh giá Hai chiều (Khách thuê & Chủ xe) | Backend (Triệu Minh Trí) | DONE |
| G5-04 | Web UI Trả xe, Quyết toán Cọc, Đánh giá & Dashboard Chủ xe | Frontend (Trần Văn Tiền) | DONE |
| G5-05 | Kiểm thử Tích hợp Toàn diện, Audit An ninh & Đóng gói Dự án | Test / QA (Trần Ngọc Minh Sang) | DONE |

---

## G5-01: Quy Trình Trả Xe, Checklist 4 Góc Sau Chuyến & Hoàn Tất Chuyến Đi (Return Inspection, Check-out Checklist & Trip Completion Engine)

```text
Mã: G5-01
Tên: Quy trình Trả xe, Checklist 4 Góc Sau Chuyến & Hoàn tất Chuyến đi (Return Inspection & Trip Completion Engine)
Mục tiêu: Hiện thực hóa quy trình trả xe và hoàn tất chuyến đi (REQ-CAR-05, REQ-CAR-06, BR-10). Cho phép khách thuê lưu nháp và ký chốt biên bản kiểm tra trả xe (CHECK_OUT) với đầy đủ 4 ảnh (FRONT, REAR, LEFT, RIGHT), số km ODO sau chuyến không nhỏ hơn trước chuyến, mức pin/xăng, ghi nhận tình trạng trầy xước mới phát sinh; gửi lệnh khóa cửa xe Keyless LOCK chốt trả xe; giải phóng lịch giữ xe (vehicle_calendar.releasedAt = now) và chuyển trạng thái booking từ IN_PROGRESS sang COMPLETED.
Prerequisite đã DONE: G4-01, G4-02, G4-03, G4-04
File cần đọc:
- docs/SRS.md (REQ-CAR-05, REQ-CAR-06, BR-08, BR-10)
- docs/API_CONTRACT.md
- apps/api/src/inspections/inspections.service.ts
- apps/api/src/bookings/bookings.service.ts
- apps/api/src/keyless/keyless.service.ts
File chính dự kiến:
- apps/api/src/inspections/inspections.service.ts (Bổ sung validation quy tắc BR-10 cho CHECK_OUT: odoEnd >= odoStart, ràng buộc trạng thái IN_PROGRESS)
- apps/api/src/bookings/bookings.controller.ts & bookings.service.ts (Endpoint POST /bookings/:id/complete, kiểm tra CHECK_OUT inspection đã finalized, chuyển booking sang COMPLETED, giải phóng vehicleCalendar.releasedAt, ghi BookingEvent TRIP_COMPLETED & Notification cho chủ xe và khách)
- apps/api/src/inspections/inspections.service.spec.ts & bookings.service.spec.ts (Unit tests)
- apps/api/test/trip-completion.e2e-spec.ts (E2E integration test luồng trả xe)
Kết quả cần có:
- API POST /bookings/:id/complete xác thực:
  - Chỉ người thuê hợp lệ của chuyến đi mới được trả xe.
  - Booking phải ở trạng thái IN_PROGRESS.
  - Biên bản kiểm tra CHECK_OUT bắt buộc đã được ký chốt (acknowledged = true) với đủ 4 ảnh góc xe.
  - Số km ODO lúc trả không được nhỏ hơn số km ODO lúc nhận (CHECK_IN).
  - Tự động chuyển booking sang COMPLETED trong transaction an toàn, giải phóng calendar reservation (releasedAt = now).
  - Ghi nhận BookingEvent TRIP_COMPLETED và tạo Notification cho cả 2 bên.
- Unit tests & E2E tests pass 100%.
- Cập nhật OpenAPI contracts và web client api.ts.
```

---

## G5-02: Quyết Toán Ký Quỹ & Xử Lý Hoàn Cọc / Phụ Phí Phát Sinh (Deposit Settlement & Surcharge Deduction Engine)

```text
Mã: G5-02
Tên: Quyết toán Ký quỹ & Xử lý Hoàn cọc / Phụ phí phát sinh (Deposit Settlement & Surcharge Engine)
Mục tiêu: Hiện thực hóa cơ chế đối soát tài chính và giải tỏa ký quỹ (escrow release / refund) sau khi chuyến đi hoàn tất (REQ-CAR-05, BR-03). Cho phép tính toán các khoản phụ phí phát sinh (nếu có: chênh lệch mức nhiên liệu/pin so với lúc nhận xe, phí rửa xe vệ sinh, phụ phí trễ giờ theo quy định) và tự động hoàn trả số dư tiền cọc thế chấp còn lại cho khách thuê qua cổng thanh toán sandbox.
Prerequisite đã DONE: G5-01
File cần đọc:
- docs/SRS.md (REQ-CAR-04, BR-03, BR-07)
- docs/DATABASE_DESIGN.md
- apps/api/src/payments/payments.service.ts
File chính dự kiến:
- prisma/schema.prisma (Bổ sung PaymentType REFUND hoặc trường settlement vào Payment/PricingSnapshot nếu cần)
- apps/api/src/payments/payments.service.ts & payments.controller.ts (Phương thức calculateSettlement, processDepositRefund, POST /bookings/:id/settle-deposit)
- apps/api/src/payments/dto/settlement.dto.ts
- apps/api/src/payments/payments.service.spec.ts (Unit tests)
- apps/api/test/deposit-settlement.e2e-spec.ts (E2E tests)
Kết quả cần có:
- Endpoint POST /bookings/:id/settle-deposit:
  - Chỉ chủ xe hoặc hệ thống vận hành sau khi booking đạt COMPLETED.
  - Tính toán chênh lệch nhiên liệu (so sánh fuelPercent lúc nhận vs trả), khấu trừ phụ phí minh bạch.
  - Số tiền hoàn cọc refundAmount = max(0, depositVnd - surchargesVnd).
  - Sinh giao dịch thanh toán hoàn tiền REFUND gắn với transactionRef gốc, trạng thái SUCCESS.
  - Ghi nhận BookingEvent DEPOSIT_SETTLED và gửi Notification tóm tắt chi phí cho khách thuê.
- Unit tests & E2E tests pass 100%.
```

---

## G5-03: Động Cơ Đánh Giá Hai Chiều (Khách Thuê & Chủ Xe) (Two-Way Reviews & Rating Engine)

```text
Mã: G5-03
Tên: Động cơ Đánh giá Hai chiều (Khách thuê & Chủ xe) (Two-Way Reviews & Rating Engine)
Mục tiêu: Xây dựng module Reviews hoàn chỉnh tuân thủ tuyệt đối quy tắc BR-12 & REQ-CAR-07. Cho phép khách thuê và chủ xe đánh giá độc lập sau khi chuyến đi đã COMPLETED (điểm 1-5 sao, nhận xét tối đa 2.000 ký tự); tính toán và cập nhật điểm trung bình (ratingAverage) và tổng lượt đánh giá (reviewCount) cho phương tiện và chủ xe; bảo đảm tính bất biến (không sửa review sau khi gửi, không đánh giá chéo tài khoản lạ).
Prerequisite đã DONE: G5-01
File cần đọc:
- docs/SRS.md (BR-12, REQ-CAR-07)
- docs/DATABASE_DESIGN.md (Bảng reviews, unique index booking_id, author_id)
File chính dự kiến:
- apps/api/src/reviews/dto/create-review.dto.ts (score 1-5, comment max 2000 ký tự)
- apps/api/src/reviews/dto/review-response.dto.ts
- apps/api/src/reviews/reviews.service.ts (Xác thực booking COMPLETED, actor thuộc booking, targetUser tự động suy từ bên còn lại, ngăn duplicate review, cập nhật điểm rating trung bình xe/chủ xe trong Prisma transaction)
- apps/api/src/reviews/reviews.controller.ts (POST /bookings/:id/reviews, GET /bookings/:id/reviews, GET /vehicles/:id/reviews)
- apps/api/src/reviews/reviews.module.ts
- apps/api/src/reviews/reviews.service.spec.ts (Unit tests)
- apps/api/test/reviews.e2e-spec.ts (E2E tests)
Kết quả cần có:
- Module Reviews hoạt động độc lập và bảo mật:
  - Chỉ cho phép đánh giá khi booking.status === COMPLETED.
  - Khách thuê đánh giá chủ xe & phương tiện; Chủ xe đánh giá khách thuê.
  - Constraint check PostgreSQL reviews_score_range (score BETWEEN 1 AND 5) và reviews_author_target_different được tuân thủ.
  - Unique index ngăn đánh giá lần 2 trên cùng một đơn đặt xe (409 CONFLICT).
  - Tự động tính toán điểm trung bình rating của xe hiển thị công khai.
- 100% test unit và e2e pass.
- OpenAPI & contracts tái sinh và cập nhật vào @carsharing/contracts.
```

---

## G5-04: Web UI Trả Xe, Quyết Toán Cọc, Đánh Giá & Dashboard Chủ Xe (Web UI Return, Settlement, Reviews & Host Dashboard)

```text
Mã: G5-04
Tên: Web UI Trả Xe, Quyết Toán Cọc, Đánh Giá & Dashboard Chủ Xe (Web UI Return, Settlement, Reviews & Host Dashboard)
Mục tiêu: Phát triển giao diện người dùng hoàn chỉnh cho toàn bộ giai đoạn kết thúc chuyến đi và hậu mãi (REQ-CAR-05, REQ-CAR-06, REQ-CAR-07, BR-13):
1. Checklist Trả Xe (Check-out Checklist Modal): Chụp 4 góc xe sau chuyến, ghi nhận ODO & mức pin, nút ký chốt biên bản và nút hoàn tất chuyến đi.
2. Bảng Quyết Toán Cọc: Hiển thị minh bạch số tiền cọc đã giữ, phụ phí phát sinh (nếu có) và số tiền hoàn cọc đã chuyển về tài khoản.
3. Form Viết Đánh Giá Hai Chiều: Giao diện chọn số sao trực quan (1-5 sao), nhập nhận xét, hiển thị đánh giá lẫn nhau sau khi hoàn tất.
4. Host Dashboard (/owner hoặc /owner/dashboard): Tổng hợp doanh thu dự kiến theo kỳ thời gian (BR-13), số đơn theo trạng thái (REQUESTED, APPROVED, IN_PROGRESS, COMPLETED, CANCELLED), tỷ lệ duyệt đơn và danh sách xe cho thuê.
Prerequisite đã DONE: G5-01, G5-02, G5-03
File cần đọc:
- docs/SRS.md (REQ-CAR-07, BR-13, Bảng màn hình)
- apps/web/src/app/bookings/[id]/page.tsx
- apps/web/src/app/owner/bookings/page.tsx
File chính dự kiến:
- apps/web/src/components/ReturnChecklistModal.tsx
- apps/web/src/components/ReviewModal.tsx
- apps/web/src/components/DepositSettlementCard.tsx
- apps/web/src/app/owner/dashboard/page.tsx (hoặc /owner/page.tsx)
- apps/web/src/app/bookings/[id]/page.tsx (tích hợp các thành phần trả xe, hoàn cọc và đánh giá)
- apps/web/test/return-review-dashboard.spec.ts (Playwright browser E2E test)
Kết quả cần có:
- Trải nghiệm người dùng mượt mà, chuẩn thẩm mỹ, dark mode accents và micro-animations.
- Playwright E2E test mô phỏng toàn bộ luồng: Trả xe -> Chốt checklist CHECK_OUT -> Khóa cửa Keyless -> Chuyển COMPLETED -> Quyết toán cọc -> Viết đánh giá 5 sao -> Xem thống kê doanh thu trên Dashboard chủ xe.
- Next.js Turbopack build 100% clean, không lỗi TypeScript hay ESLint.
```

---

## G5-05: Kiểm Thử Tích Hợp Toàn Diện, Audit An Ninh & Đóng Gói Dự Án (End-to-End System Integration, Security Audit & Project Final Release)

```text
Mã: G5-05
Tên: Kiểm Thử Tích Hợp Toàn Diện, Audit An Ninh & Đóng Gói Toàn Bộ Dự Án (Final Integration & Project Release)
Mục tiêu: Thực hiện kiểm thử toàn diện toàn bộ nền tảng Car Sharing từ G0 đến G5; audit an ninh bảo mật (kiểm tra rò rỉ secrets, kiểm tra CSRF/CORS, kiểm tra che giấu biển số và địa chỉ đón trả xe); đối chiếu 100% với tài liệu SRS 1.1 và các biên bản nghiệm thu; đảm bảo toàn bộ pipeline CI/CD xanh sạch và đóng gói bàn giao hoàn tất cho nhóm học tập.
Prerequisite đã DONE: G5-01, G5-02, G5-03, G5-04
File cần đọc:
- docs/SRS.md (Mục 5 Yêu cầu phi chức năng NFR-01 -> NFR-06, Mục 7 Truy vết yêu cầu)
- docs/PROGRESS.md
- docs/VERIFICATION.md
File chính dự kiến:
- docs/PROGRESS.md (Cập nhật 100% DONE toàn bộ dự án, bảng tổng kết các Milestone G0-G5)
- docs/VERIFICATION.md (Bảng ma trận kiểm chứng thực tế toàn diện)
- README.md (Hướng dẫn khởi chạy, tổng quan kiến trúc và kết quả đạt được)
Kết quả cần có:
- 100% backend tests (unit, constraint, e2e) pass xanh sạch.
- 100% Playwright browser smoke test suites pass trên Chromium.
- pnpm run typecheck: 0 lỗi trên toàn bộ workspace.
- pnpm run build: Build sản phẩm sạch sẽ cả API và Web.
- pnpm run format:check: 100% Prettier compliant.
- Toàn bộ tài liệu Word và sao lưu được bảo toàn nguyên vẹn.
```
