# Task Cards Milestone G4: Bàn Giao Xe, Khóa Ảo Keyless & Vận Hành Chuyến Đi (Inspection, Virtual Keyless & Active Trip Operations)

Chi tiết các task thuộc Milestone G4 theo SRS 1.1, UC-07 (Checklist nhận xe & ghi nhận hiện trạng), UC-08 (Mở khóa xe tự động Keyless), BR-09 và API_CONTRACT.md.

---

## G4-01: Quy Trình Bàn Giao & Checklist 4 Góc Xe (Handover & Inspection Engine)

```text
Mã: G4-01
Tên: Quy Trình Bàn Giao & Checklist 4 Góc Xe (Handover & Inspection Engine)
Mục tiêu: Hiện thực hóa quy trình kiểm tra hiện trạng xe trước và sau chuyến đi (UC-07). Hỗ trợ upload ảnh 4 góc xe (FRONT, REAR, LEFT, RIGHT) cùng nội thất/công tơ mét (INTERIOR, ODOMETER) qua S3 Presigned URLs bảo mật, ghi nhận số km (odometerKm), mức nhiên liệu/pin (fuelPercent), ghi chú vết trầy xước (damageNotes). Đảm bảo tính toàn vẹn dữ liệu: checklist được chốt bất biến (finalized) chỉ khi đầy đủ 4 góc ảnh đã verify, ngăn chặn giả mạo trạng thái từ client.
Prerequisite đã DONE: G3-04
File cần đọc:
- docs/API_CONTRACT.md (phần Media và checklist)
- docs/DATABASE_DESIGN.md (bảng inspections, inspection_photos, media)
- docs/SRS.md (BR-09, quy tắc upload ảnh và phân quyền private)
- prisma/schema.prisma
File chính dự kiến:
- prisma/schema.prisma (bổ sung model Inspection, InspectionPhoto, enum InspectionType: PICKUP/RETURN, CarAngle: FRONT/REAR/LEFT/RIGHT/INTERIOR/ODOMETER)
- prisma/migrations/20261027110000_add_inspections/migration.sql
- apps/api/src/inspections/inspections.module.ts
- apps/api/src/inspections/inspections.service.ts
- apps/api/src/inspections/inspections.controller.ts
- apps/api/src/inspections/dto/save-inspection.dto.ts
- apps/api/src/inspections/dto/finalize-inspection.dto.ts
- apps/api/src/inspections/dto/inspection-response.dto.ts
- apps/api/src/inspections/inspections.service.spec.ts
- apps/api/test/inspections.e2e-spec.ts
File liên quan bắt buộc:
- apps/api/src/app.module.ts
- tools/export-openapi.mjs
- packages/contracts/src/schema.ts
- apps/web/src/lib/api.ts
Kết quả cần có:
- Migration Prisma & Database:
  - Bảng `inspections`: id, bookingId, type (PICKUP/RETURN), actorId, odometerKm, fuelPercent, damageNotes, isFinalized, finalizedAt, version.
  - Bảng `inspection_photos`: id, inspectionId, mediaId, angle (FRONT, REAR, LEFT, RIGHT, INTERIOR, ODOMETER).
  - Check constraint: odometerKm >= 0, fuelPercent >= 0 AND fuelPercent <= 100.
  - Unique constraint: UNIQUE(booking_id, type) và UNIQUE(inspection_id, angle).
- Endpoint PUT /api/v1/bookings/:id/inspections:
  - Header X-CSRF-Token và SessionGuard. Chỉ renter hoặc owner của booking được phép thao tác (403 FORBIDDEN).
  - Booking phải ở trạng thái APPROVED (đối với PICKUP) hoặc IN_PROGRESS (đối với RETURN).
  - Hỗ trợ lưu bản nháp (draft) nhiều lần với version concurrency control.
  - Liên kết các mediaId đã được verified trên MinIO S3 (purpose: INSPECTION_PHOTO).
- Endpoint POST /api/v1/bookings/:id/inspections/:type/finalize:
  - Kiểm tra điều kiện bắt buộc: phải có đủ 4 ảnh các góc FRONT, REAR, LEFT, RIGHT đã verify trên S3.
  - Đánh dấu isFinalized = true, ghi nhận finalizedAt.
  - Ghi BookingEvent (CHECKLIST_COMPLETED) và thông báo Notification cho đối tác.
- Endpoint GET /api/v1/bookings/:id/inspections:
  - Trả về danh sách checklist PICKUP và RETURN kèm danh sách ảnh và presigned read-url (TTL 300s, private).
- Kiểm thử:
  - Unit tests cho InspectionsService (lưu nháp, kiểm tra 4 góc, concurrency version, finalize).
  - E2E tests bao phủ 401, 403 (người ngoài), 400 (thiếu góc ảnh), 200/201 luồng lưu nháp và finalize thành công.
Không mở rộng sang: Chưa kích hoạt lệnh khóa mở xe Keyless (thuộc G4-02).
```

---

## G4-02: Bộ Điều Khiển Khóa Ảo Keyless & Adapter Simulator (Virtual Keyless Control & Hardware Simulator)

```text
Mã: G4-02
Tên: Bộ Điều Khiển Khóa Ảo Keyless & Adapter Simulator (Virtual Keyless Control & Hardware Simulator)
Mục tiêu: Hiện thực hóa quy trình mở/khóa xe tự động không cần gặp mặt (UC-08). Xây dựng cơ chế Keyless State Machine bảo mật cao: xác thực quyền người thuê, kiểm tra khung giờ hiệu lực [startAt, endAt), đảm bảo checklist trước chuyến (PICKUP) đã hoàn tất (isFinalized = true), và kiểm tra ràng buộc partial unique index không có thao tác nào chưa giải quyết (PENDING/UNKNOWN). Cung cấp Adapter Simulator giả lập phần cứng viễn thông IoT xe ô tô với khả năng đối soát (reconcile) và audit log. Tự động chuyển booking từ APPROVED sang IN_PROGRESS khi mở khóa nhận xe thành công.
Prerequisite đã DONE: G4-01
File cần đọc:
- docs/API_CONTRACT.md (phần Keyless operations)
- docs/DATABASE_DESIGN.md (bảng keyless_operations, partial unique index keyless_one_unresolved_per_booking)
- docs/SRS.md (BR-09, Hardware simulator specifications)
- prisma/schema.prisma
File chính dự kiến:
- prisma/schema.prisma (bổ sung model KeylessOperation, enum KeylessAction: UNLOCK/LOCK/START/COMPLETE, enum KeylessStatus: PENDING/SUCCEEDED/FAILED/UNKNOWN/MANUAL_CONFIRMED)
- prisma/migrations/20261027113000_add_keyless_operations/migration.sql
- apps/api/src/keyless/keyless.module.ts
- apps/api/src/keyless/keyless.service.ts
- apps/api/src/keyless/keyless.controller.ts
- apps/api/src/keyless/adapters/keyless-simulator.adapter.ts
- apps/api/src/keyless/dto/trigger-keyless.dto.ts
- apps/api/src/keyless/dto/keyless-operation-response.dto.ts
- apps/api/src/keyless/keyless.service.spec.ts
- apps/api/test/keyless.e2e-spec.ts
File liên quan bắt buộc:
- apps/api/src/app.module.ts
- tools/export-openapi.mjs
- packages/contracts/src/schema.ts
- apps/web/src/lib/api.ts
Kết quả cần có:
- Migration Prisma & Partial Unique Index:
  - Model `KeylessOperation`: id, bookingId, actorId, action (UNLOCK, LOCK, START, COMPLETE), idempotencyKey, requestHash, status (PENDING, SUCCEEDED, FAILED, UNKNOWN, MANUAL_CONFIRMED), provider, deviceResult, leaseUntil, createdAt, resolvedAt.
  - Partial Unique Index: `CREATE UNIQUE INDEX keyless_one_unresolved_per_booking ON keyless_operations(booking_id) WHERE status IN ('PENDING', 'UNKNOWN');` (chống race conditions phát sinh nhiều lệnh điều khiển song song).
- KeylessSimulatorAdapter:
  - Giả lập độ trễ viễn thông IoT xe (50-200ms).
  - Hỗ trợ các kịch bản mô phỏng: SUCCEEDED (mở khóa xe thành công), TIMEOUT/UNKNOWN (mất sóng di động dưới hầm), HARDWARE_ERROR (cửa xe bị kẹt).
  - Ghi nhận telemetry logs (mã lệnh commandId, mã pin ảo, trạng thái chốt cửa).
- Endpoint POST /api/v1/bookings/:id/keyless-operations:
  - Header Idempotency-Key bắt buộc.
  - Xác thực nghiêm ngặt BR-09:
    1. Actor phải là Renter của booking (@CurrentUser).
    2. Xe phải có keylessSupported = true.
    3. Trạng thái booking phải là APPROVED (đối với START/UNLOCK nhận xe) hoặc IN_PROGRESS.
    4. Khung giờ thuê hợp lệ: startAt <= now < endAt (cho phép linh hoạt 15 phút trước giờ nhận).
    5. Checklist nhận xe PICKUP phải ở trạng thái isFinalized = true (422 CHECKLIST_INCOMPLETE).
    6. Chặn nếu đang có lệnh PENDING/UNKNOWN chưa giải quyết (409 UNRESOLVED_OPERATION).
  - Thực thi tạo KeylessOperation PENDING -> gọi Adapter -> cập nhật SUCCEEDED/FAILED.
  - Nếu action là START hoặc UNLOCK đầu tiên thành công: tự động chuyển Booking status từ APPROVED sang IN_PROGRESS, ghi BookingEvent (TRIP_STARTED) và gửi thông báo Notification.
- Endpoint GET /api/v1/bookings/:id/keyless-operations/:operationId:
  - Tra cứu trạng thái chi tiết của lệnh điều khiển khóa xe.
- Endpoint POST /api/v1/bookings/:id/keyless-operations/:operationId/reconcile:
  - Đối soát trạng thái lệnh điều khiển đang ở trạng thái UNKNOWN hoặc PENDING.
- Kiểm thử:
  - Unit tests cho KeylessService & Adapter (xác thực thời gian, kiểm tra checklist, state transitions, idempotency).
  - E2E tests: 401 unauthenticated, 403 non-renter, 422 thiếu checklist, 409 xung đột partial unique index, 202/200 mở khóa thành công chuyển IN_PROGRESS.
Không mở rộng sang: Chưa làm giao diện Web UI chìa khóa số (thuộc G4-03).
```

---

## G4-03: Web UI Bàn Giao Xe, Chụp Ảnh Checklist & Điều Khiển Khóa Xe (Web UI Handover, Inspection & Keyless Control)

```text
Mã: G4-03
Tên: Web UI Bàn Giao Xe, Chụp Ảnh Checklist & Điều Khiển Khóa Xe (Web UI Handover, Inspection & Keyless Control)
Mục tiêu: Hiện thực hóa giao diện tương tác trực tiếp cho người dùng tại bãi xe: hoàn thiện checklist 4 góc xe bằng camera/file upload trực tiếp lên S3 qua presigned URLs, hiển thị giao diện Chìa Khóa Ảo (Digital Smart Key Fob) với nút Mở khóa / Khóa xe tương tác mượt mà, phản hồi rung/âm thanh giả lập và trạng thái chuyến đi IN_PROGRESS trực quan.
Prerequisite đã DONE: G4-02
File cần đọc:
- apps/web/src/app/bookings/[id]/page.tsx
- apps/web/src/lib/api.ts
- apps/web/src/components/UserNav.tsx
File chính dự kiến:
- apps/web/src/components/InspectionChecklistModal.tsx (Modal chụp ảnh 4 góc xe FRONT, REAR, LEFT, RIGHT + ODOMETER + INTERIOR, preview ảnh, thanh tiến độ % hoàn thành, nhập số km và xăng)
- apps/web/src/components/KeylessRemoteWidget.tsx (Widget chìa khóa số thông minh: nút Mở khóa xe, Khóa xe, đèn LED trạng thái kết nối IoT, vòng đếm thời gian hiệu lực, hiệu ứng âm thanh/phản hồi trực quan)
- apps/web/src/app/bookings/[id]/inspection/page.tsx (Trang quy trình bàn giao xe chuyên dụng)
- apps/web/src/app/bookings/[id]/page.tsx (Tích hợp KeylessRemoteWidget và nút Mở checklist khi đơn APPROVED/IN_PROGRESS)
- apps/web/test/inspection-keyless.spec.ts (Playwright E2E browser test: duyệt đơn -> chụp 4 ảnh checklist -> hoàn tất bàn giao -> bấm mở khóa Keyless -> trạng thái cập nhật IN_PROGRESS)
File liên quan bắt buộc:
- apps/web/src/lib/api.ts (Bổ sung saveInspectionApi, finalizeInspectionApi, triggerKeylessApi, fetchKeylessOpApi)
- apps/web/src/components/BookingStatusBadge.tsx
Kết quả cần có:
- Component InspectionChecklistModal / Trang Inspection:
  - 4 ô upload ảnh trực quan cho 4 góc xe bắt buộc: Đầu xe (FRONT), Đuôi xe (REAR), Sườn trái (LEFT), Sườn phải (RIGHT).
  - 2 ô tùy chọn: Mặt đồng hồ công tơ mét (ODOMETER), Khoang lái nội thất (INTERIOR).
  - Tải ảnh trực tiếp lên MinIO S3 bằng presigned PUT URL qua api.ts, gọi verify media.
  - Nhập số km hiện tại (odometerKm) và vạch pin/xăng % (fuelPercent), ghi chú vết xước sẵn có.
  - Nút "Hoàn tất & Ký xác nhận biên bản bàn giao" chỉ sáng khi đủ 4 góc ảnh.
- Component KeylessRemoteWidget:
  - Hiển thị nổi bật trên trang chi tiết chuyến đi /bookings/[id] khi xe hỗ trợ Keyless.
  - Trạng thái chốt cửa (ĐANG KHÓA / ĐÃ MỞ KHÓA).
  - Nút "Mở khóa xe (Unlock)" và "Khóa xe (Lock)" với hiệu ứng viền sáng (ring glow), rung phản hồi và thông báo xác nhận.
  - Cảnh báo trực quan nếu chưa hoàn tất checklist nhận xe: hiển thị nút "Yêu cầu chụp ảnh kiểm tra xe trước khi nhận chìa".
- Playwright E2E Test (apps/web/test/inspection-keyless.spec.ts):
  - Kịch bản end-to-end:
    1. Đăng nhập renter1, truy cập đơn đặt xe đã APPROVED.
    2. Mở checklist bàn giao nhận xe, upload 4 ảnh giả lập (FRONT, REAR, LEFT, RIGHT), nhập km và bấm xác nhận hoàn tất.
    3. Thẻ Chìa Khóa Ảo Keyless hiển thị sẵn sàng.
    4. Bấm "Mở khóa xe (Keyless Unlock)" -> Gọi API mô phỏng IoT -> Cửa xe mở thành công.
    5. Trang cập nhật trạng thái chuyến đi sang "ĐANG DIỄN RA" (IN_PROGRESS).
- Thẩm mỹ & Trải nghiệm:
  - Thiết kế sang trọng, dark mode accent cho Digital Key fob, mượt mà trên mobile viewport.
Không mở rộng sang: Chưa làm quy trình trả xe và thanh toán quyết toán cuối chuyến (thuộc Milestone G5).
```

---

## G4-04: Kiểm Tra Tích Hợp Toàn Diện, CI/CD Pipeline & Đóng Gói Milestone G4 (Packaging & Preparing Milestone G5)

```text
Mã: G4-04
Tên: Kiểm Tra Tích Hợp Toàn Diện, CI/CD Pipeline & Đóng Gói Milestone G4 (Packaging & Preparing Milestone G5)
Mục tiêu: Chạy toàn bộ pipeline kiểm thử chất lượng mã nguồn (TypeScript strict, NestJS build, Next.js Turbopack build, toàn bộ test suite backend và Playwright browser E2E test suites) đảm bảo không có bất kỳ hồi quy nào. Thiết lập kế hoạch chi tiết cho Milestone G5 (Trả xe, Quyết toán cọc, Đánh giá 2 chiều & Dashboard chủ xe).
Prerequisite đã DONE: G4-01, G4-02, G4-03
File cần đọc:
- docs/PROGRESS.md
- docs/SRS.md (UC-09 Trả xe & hoàn tất chuyến đi, UC-10 Đánh giá hai chiều, UC-11 Dashboard chủ xe)
- docs/DECISIONS.md
File chính dự kiến:
- docs/PROGRESS.md (Cập nhật 100% hoàn thành Milestone G4, bổ sung bảng Milestone G5)
- docs/tasks/G5_TASKS.md (Soạn thảo chi tiết các task cards cho Milestone G5)
Kết quả cần có:
- Toàn bộ lệnh kiểm thử bắt buộc pass 100%:
  - pnpm run typecheck: 0 lỗi TypeScript trên cả 3 packages (@carsharing/api, @carsharing/web, @carsharing/contracts).
  - pnpm run build: Build sản phẩm clean, tối ưu hóa toàn bộ các routes tĩnh/động.
  - pnpm run test: Toàn bộ test suite backend (unit, constraint, e2e) pass 100%.
  - pnpm run test:smoke: 100% browser suites pass trên Playwright Chromium.
  - pnpm run format:check: Tuân thủ 100% định dạng Prettier.
- Tài liệu hóa:
  - docs/PROGRESS.md cập nhật đầy đủ nhật ký thực tế của từng task G4.
  - docs/tasks/G5_TASKS.md hoàn thiện sẵn sàng cho giai đoạn phát triển tiếp theo.
```
