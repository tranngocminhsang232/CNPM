# Task Cards Milestone G3: Quy Trình Đặt Xe, Thanh Toán & Quản Lý Vòng Đời (Booking & Payment)

Chi tiết các task thuộc Milestone G3 theo SRS 1.1, UC-05 (Đặt xe & phê duyệt), UC-06 (Thanh toán & đặt cọc) và API_CONTRACT.md.

---

## G3-01: Động Cơ Đặt Xe & Quản Lý Vòng Đời Trạng Thái (Booking Lifecycle & State Machine)

```text
Mã: G3-01
Tên: Động Cơ Đặt Xe & Quản Lý Vòng Đời Trạng Thái (Booking Lifecycle & State Machine)
Mục tiêu: Hiện thực hóa quy trình nghiệp vụ UC-05: Renter tạo yêu cầu đặt xe với Idempotency-Key và expectedTotalVnd, hệ thống khóa lịch xe trong PostgreSQL (GiST exclusion), snapshot biểu phí bất biến (pricing_snapshots), tạo đơn trạng thái REQUESTED với requestExpiresAt 15 phút. Cung cấp API phê duyệt (approve), từ chối (reject), và hủy đơn (cancel), tự động giải phóng lịch xe khi đơn bị từ chối hoặc hủy.
Prerequisite đã DONE: G2-05
File cần đọc:
- docs/API_CONTRACT.md (phần Quote và booking)
- docs/DATABASE_DESIGN.md (bảng bookings, pricing_snapshots, idempotency_records, vehicle_calendar, booking_events, notifications)
- prisma/schema.prisma
- apps/api/src/pricing/pricing.service.ts
File chính dự kiến:
- apps/api/src/bookings/bookings.module.ts
- apps/api/src/bookings/bookings.service.ts
- apps/api/src/bookings/bookings.controller.ts
- apps/api/src/bookings/dto/create-booking.dto.ts
- apps/api/src/bookings/dto/booking-response.dto.ts
- apps/api/src/bookings/dto/query-bookings.dto.ts
- apps/api/src/bookings/dto/booking-action.dto.ts
- apps/api/src/bookings/bookings.service.spec.ts
- apps/api/test/bookings.e2e-spec.ts
File liên quan bắt buộc:
- apps/api/src/app.module.ts
- packages/contracts/openapi.json
- packages/contracts/src/schema.ts
- apps/web/src/lib/api.ts
Kết quả cần có:
- Endpoint POST /api/v1/bookings:
  - Header Idempotency-Key bắt buộc (16–128 ký tự).
  - Tự động lấy actorId từ phiên đăng nhập (@CurrentUser). Yêu cầu đã KYC (@UseGuards(SessionGuard, KycVerifiedGuard)).
  - Canonical hash idempotency gồm vehicleId, startAt UTC, endAt UTC, expectedTotalVnd, pricingVersion. Replay trả về cùng booking nếu hash khớp; trả 409 IDEMPOTENCY_MISMATCH nếu hash khác.
  - Chặn chủ xe tự đặt xe của chính mình: 403 SELF_BOOKING_FORBIDDEN (phù hợp check constraint bookings_renter_not_owner).
  - Tái tính toán giá: nếu totalVnd tính lại khác expectedTotalVnd -> trả 409 PRICE_CHANGED kèm quote mới.
  - Thực thi trong Prisma Transaction duy nhất:
    1. Tạo Booking status REQUESTED, requestExpiresAt = now + 15m.
    2. Tạo PricingSnapshot bất biến (đáp ứng constraint pricing_snapshots_non_negative).
    3. Tạo VehicleCalendar kind BOOKING covering [startAt, endAt) (nếu trùng lịch PostgreSQL GiST ném lỗi -> chuyển thành 409 VEHICLE_UNAVAILABLE).
    4. Tạo IdempotencyRecord.
    5. Tạo BookingEvent (eventType BOOKING_REQUESTED).
    6. Tạo Notification cho chủ xe.
- Endpoint GET /api/v1/bookings:
  - Query perspective=renter hoặc perspective=owner, lọc theo status, phân trang page/pageSize.
  - Chỉ trả về các đơn mà actor là renter hoặc owner.
- Endpoint GET /api/v1/bookings/:id:
  - Trả về BookingDetailDto kèm thông tin xe, pricingSnapshot, renter, owner.
  - Bảo mật: chặn người dùng không thuộc đơn thuê xem chi tiết (403 FORBIDDEN).
- Endpoint POST /api/v1/bookings/:id/approve:
  - Chỉ chủ xe (ownerId === actorId) được duyệt.
  - Trạng thái hiện tại phải là REQUESTED -> chuyển sang APPROVED.
  - Ghi BookingEvent và Notification cho khách thuê.
- Endpoint POST /api/v1/bookings/:id/reject:
  - Chỉ chủ xe được từ chối; nhập reason (1-500 ký tự).
  - Trạng thái hiện tại phải là REQUESTED -> chuyển REJECTED.
  - Giải phóng lịch xe: cập nhật vehicle_calendar.releasedAt = now().
  - Ghi BookingEvent và Notification cho khách thuê.
- Endpoint POST /api/v1/bookings/:id/cancel:
  - Renter hoặc Owner có thể hủy đơn (khi đang ở REQUESTED hoặc APPROVED trước giờ bắt đầu).
  - Nhập reason (1-500 ký tự).
  - Chuyển status CANCELLED, giải phóng lịch xe (releasedAt = now()).
  - Ghi BookingEvent và Notification.
Không mở rộng sang: Không thực hiện giao nhận xe vật lý hay mở khóa keyless (thuộc Milestone G4).
Ca kiểm tra và expected:
- POST /bookings hợp lệ -> 201 Created, snapshot và calendar được tạo trong cùng transaction.
- POST /bookings gửi lại cùng Idempotency-Key và payload -> 200 OK replay không tạo trùng.
- POST /bookings gửi cùng Idempotency-Key nhưng khác payload -> 409 IDEMPOTENCY_MISMATCH.
- Hai khách thuê cùng đặt trùng lịch xe -> 1 người thành công, người thứ hai nhận 409 VEHICLE_UNAVAILABLE.
- Chủ xe tự đặt xe của mình -> 403 SELF_BOOKING_FORBIDDEN.
- Chủ xe duyệt đơn -> 200 APPROVED; từ chối -> 200 REJECTED và calendar được release.
Lệnh kiểm tra thực tế:
- pnpm --filter @carsharing/api test
- pnpm --filter @carsharing/api test:e2e
Điều kiện DONE: 100% unit tests và e2e tests pass, hợp đồng OpenAPI cập nhật.
```

---

## G3-02: Đặt Cọc Giữ Chỗ & Cổng Thanh Toán Sandbox (Payment Gateway, Escrow & Webhook)

```text
Mã: G3-02
Tên: Đặt Cọc Giữ Chỗ & Cổng Thanh Toán Sandbox (Payment Gateway, Escrow & Webhook)
Mục tiêu: Xây dựng module thanh toán (PaymentsModule) tích hợp cổng thanh toán Sandbox (mô phỏng chuẩn VNPay / MoMo) để xử lý thanh toán tiền cọc giữ chỗ (depositVnd) và thanh toán toàn bộ chi phí thuê xe. Hỗ trợ tạo intent thanh toán, URL redirect sandbox, và webhook/IPN xác thực chữ ký số HMAC-SHA512 để xác nhận giao dịch an toàn.
Prerequisite đã DONE: G3-01
File cần đọc:
- docs/API_CONTRACT.md
- apps/api/src/bookings/bookings.service.ts
File chính dự kiến:
- apps/api/src/payments/payments.module.ts
- apps/api/src/payments/payments.service.ts
- apps/api/src/payments/payments.controller.ts
- apps/api/src/payments/dto/create-payment-intent.dto.ts
- apps/api/src/payments/dto/payment-webhook.dto.ts
- apps/api/src/payments/payments.service.spec.ts
- apps/api/test/payments.e2e-spec.ts
File liên quan bắt buộc:
- apps/api/src/app.module.ts
- packages/contracts/openapi.json
- packages/contracts/src/schema.ts
- apps/web/src/lib/api.ts
Kết quả cần có:
- Endpoint POST /api/v1/payments/create-intent:
  - Đầu vào: bookingId, paymentType (DEPOSIT, FULL_PAYMENT), returnUrl.
  - Kiểm tra quyền sở hữu đơn thuê (chỉ renter mới được tạo thanh toán).
  - Kiểm tra trạng thái đơn: đơn phải ở trạng thái REQUESTED hoặc APPROVED.
  - Sinh mã giao dịch độc nhất (transactionRef), tính số tiền cần thanh toán, sinh chữ ký HMAC-SHA512 an toàn.
  - Trả về paymentUrl dẫn đến trang thanh toán sandbox.
- Endpoint POST /api/v1/payments/webhook (IPN callback):
  - Xác thực chữ ký HMAC checksum từ payment gateway.
  - Kiểm tra idempotency: nếu giao dịch đã xử lý thì trả về kết quả cũ, không cộng trừ kép.
  - Khi thanh toán cọc thành công: cập nhật thông tin thanh toán, ghi nhận BookingEvent (PAYMENT_RECEIVED).
  - Khi thanh toán thất bại / hủy: ghi nhận sự kiện tương ứng.
- Endpoint GET /api/v1/payments/simulate/:txRef (Hỗ trợ môi trường demo / testing):
  - Cho phép giả lập thanh toán thành công hoặc thất bại trong môi trường dev/test.
Không mở rộng sang: Không liên kết với thẻ tín dụng quốc tế Stripe hay ngân hàng thật bên ngoài.
Ca kiểm tra và expected:
- Tạo payment intent thành công trả về redirect URL và transactionRef.
- Webhook với chữ ký hợp lệ chuyển trạng thái giao dịch sang SUCCESS.
- Webhook với chữ ký giả mạo bị từ chối 400/403.
- Webhook gửi lại 2 lần (idempotent) không gây lỗi dữ liệu.
Lệnh kiểm tra thực tế:
- pnpm --filter @carsharing/api test
- pnpm --filter @carsharing/api test:e2e
Điều kiện DONE: Đầy đủ unit và e2e test cho toàn bộ luồng thanh toán và webhook signature.
```

---

## G3-03: Giao Diện Web Đặt Xe, Thanh Toán & Quản Lý Chuyến Đi (Booking Checkout & Trip UI)

```text
Mã: G3-03
Tên: Giao Diện Web Đặt Xe, Thanh Toán & Quản Lý Chuyến Đi (Booking Checkout & Trip UI)
Mục tiêu: Xây dựng toàn bộ giao diện phía người dùng cho luồng đặt xe: trang xác nhận đơn thuê & thanh toán đặt cọc (/checkout), trang danh sách chuyến đi của tôi (/bookings) kèm chi tiết hành trình (/bookings/[id]), và bảng điều khiển yêu cầu đặt xe dành cho chủ xe (/owner/bookings) với tính năng 1-click duyệt/từ chối nhanh chóng.
Prerequisite đã DONE: G3-02
File cần đọc:
- apps/web/src/components/PricingCalculator.tsx
- apps/web/src/app/vehicles/[id]/page.tsx
- packages/contracts/src/schema.ts
File chính dự kiến:
- apps/web/src/app/checkout/page.tsx
- apps/web/src/app/bookings/page.tsx
- apps/web/src/app/bookings/[id]/page.tsx
- apps/web/src/app/owner/bookings/page.tsx
- apps/web/src/components/BookingStatusBadge.tsx
- apps/web/src/components/PaymentModal.tsx
- apps/web/src/lib/api.ts
- apps/web/test/booking-flow.spec.ts
File liên quan bắt buộc:
- apps/web/src/components/UserNav.tsx
- apps/web/src/components/PricingCalculator.tsx
Kết quả cần có:
- Luồng checkout liền mạch:
  - Từ widget tính giá trên `/vehicles/[id]`, bấm "Tiến hành đặt xe" -> chuyển hướng đến `/checkout?vehicleId=...&startAt=...&endAt=...&insurance=...&voucher=...`.
  - Trang `/checkout` hiển thị tóm tắt xe, biểu phí chi tiết, chính sách cọc và nút "Xác nhận & Thanh toán cọc".
  - Tự động sinh Idempotency-Key và gọi POST `/api/v1/bookings`.
  - Hiển thị modal giả lập thanh toán sandbox với 2 nút: "Thanh toán thành công" hoặc "Hủy giao dịch".
- Trang `/bookings` (Khách thuê):
  - Danh sách đơn đặt xe theo tab: Tất cả, Chờ duyệt, Đã duyệt, Đang diễn ra, Đã hoàn thành, Đã hủy.
  - Thẻ thông tin từng đơn: ảnh xe, tên xe, biển số (nếu đã duyệt), ngày nhận/trả, tổng tiền, trạng thái.
  - Nút Hủy đơn (có modal nhập lý do).
- Trang `/bookings/[id]`:
  - Chi tiết lịch trình, địa chỉ đón xe (chỉ hiển thị khi đã APPROVED), snapshot biểu phí, thông tin liên hệ chủ xe.
- Trang `/owner/bookings` (Chủ xe):
  - Hộp thư yêu cầu đặt xe mới (status REQUESTED) có đếm ngược thời gian hết hạn (15 phút).
  - Nút 1-click "Duyệt yêu cầu" hoặc "Từ chối" (mở modal nhập lý do từ chối).
- Playwright E2E browser test bao phủ toàn bộ luồng 2 vai: Renter đặt xe -> Owner duyệt -> Renter kiểm tra trạng thái cập nhật APPROVED.
Không mở rộng sang: Không làm giao diện checklist bàn giao xe (thuộc Milestone G4).
Ca kiểm tra và expected:
- Renter thực hiện đặt xe trên giao diện thành công -> chuyển sang trang chi tiết chuyến đi.
- Owner đăng nhập vào /owner/bookings nhìn thấy yêu cầu mới -> bấm Duyệt -> đơn chuyển thành APPROVED.
- Playwright E2E test pass 100% trên Chromium.
Lệnh kiểm tra thực tế:
- pnpm --filter @carsharing/web build
- pnpm --filter @carsharing/web exec playwright test test/booking-flow.spec.ts
Điều kiện DONE: Next.js build không lỗi, Playwright test bao phủ 2 vai trò hoàn tất thành công.
```

---

## G3-04: Đóng Gói, Kiểm Thử Tích Hợp Toàn Diện & Kế Hoạch Milestone G4 (Checklist & Keyless)

```text
Mã: G3-04
Tên: Đóng Gói, Kiểm Thử Tích Hợp Toàn Diện & Kế Hoạch Milestone G4 (Checklist & Keyless)
Mục tiêu: Chạy toàn bộ pipeline kiểm thử toàn diện (typecheck, build, unit tests, integration constraint tests, e2e API tests, và toàn bộ browser tests), cập nhật tiến độ PROGRESS.md và lập danh sách task cards cho Milestone G4 (Bàn Giao Xe, Checklist 4 Góc & Khóa Ảo Keyless).
Prerequisite đã DONE: G3-01 đến G3-03
File cần đọc:
- docs/PROGRESS.md
- docs/IMPLEMENTATION_PLAN.md (phần G4)
File chính dự kiến:
- docs/PROGRESS.md
- docs/tasks/G4_TASKS.md
File liên quan bắt buộc:
- apps/api/test/*
- apps/web/test/*
Kết quả cần có:
- 100% bài kiểm tra tự động toàn hệ thống đều pass.
- Đảm bảo tính toàn vẹn dữ liệu: không có lỗi rò rỉ secret, không có mock stubs trong mã nguồn production.
- Hoàn tất bảng tiến độ Milestone G3 trong docs/PROGRESS.md (100% DONE).
- Lập bộ task cards Milestone G4 chi tiết:
  - G4-01: Quy trình Bàn Giao & Checklist 4 Góc Xe (UC-07 Handover & Inspection).
  - G4-02: Bộ Điều Khiển Khóa Ảo Keyless & Adapter Simulator (UC-08 Keyless Simulator & Safe State).
  - G4-03: Web UI Bàn Giao Xe, Chụp Ảnh Checklist & Điều Khiển Khóa Xe.
  - G4-04: Đóng Gói Milestone G4.
Lệnh kiểm tra thực tế:
- pnpm run typecheck
- pnpm run build
- pnpm run test
- pnpm run test:smoke
- pnpm run format:check
Điều kiện DONE: Toàn bộ pipeline xanh 100%, sẵn sàng chuyển giao sang Milestone G4.
```
