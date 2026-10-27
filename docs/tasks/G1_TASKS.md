# Danh Sách Task Cards G1: Xác Thực, Phân Quyền, Hồ Sơ & Đăng Ký Xe

Tài liệu được lập theo nhiệm vụ **G0-12** sau khi hoàn tất toàn bộ baseline hạ tầng, database, API contract và web client G0.  
Tuân thủ định dạng mẫu task card chuẩn tại `docs/tasks/G0_TASKS.md` (dòng 115–128).

---

## G1-01: Nền tảng Xác thực (Session Cookies, CSRF, AuthModule)

```text
ID và tên: G1-01 Nền tảng Xác thực (Session Cookies, CSRF, AuthModule)
Yêu cầu SRS/API liên quan: UC-01, ADR-03 (Cookie HttpOnly + Double Submit CSRF), API POST /api/v1/auth/login, POST /api/v1/auth/logout, GET /api/v1/auth/me, POST /api/v1/auth/google/callback
Prerequisite đã DONE: G0-12 (Toàn bộ G0 hoàn tất)
File cần đọc: docs/SRS.md, docs/API_CONTRACT.md, docs/DECISIONS.md#ADR-03, apps/api/src/common/index.ts, prisma/schema.prisma
File chính dự kiến:
- apps/api/src/auth/auth.module.ts
- apps/api/src/auth/auth.service.ts
- apps/api/src/auth/auth.controller.ts
- apps/api/src/auth/guards/session.guard.ts
- apps/api/src/auth/guards/csrf.guard.ts
- apps/api/src/auth/decorators/current-user.decorator.ts
- apps/api/src/auth/dto/login.dto.ts
File liên quan bắt buộc: apps/api/src/app.module.ts, apps/api/src/main.ts, packages/contracts/openapi.json
Kết quả cần có:
- Quản lý phiên làm việc bằng cookie HttpOnly an toàn (SameSite=Lax, Secure khi production).
- Cơ chế bảo vệ CSRF qua Double Submit Token header X-CSRF-Token cho các request thay đổi trạng thái (POST, PATCH, DELETE).
- Đăng nhập local/demo cho 4 tài khoản seed và giả lập Google OIDC callback tạo/gắn session hợp lệ.
- Hỗ trợ mô hình khả năng (capability model): một User duy nhất có thể vừa là chủ xe vừa là khách thuê mà không phải đổi role.
- GET /api/v1/auth/me trả về thông tin người dùng hiện tại (id, email, fullName, phoneNumber, role/capabilities, kycStatus).
Không mở rộng sang: Chưa tích hợp KYC bằng lái xe (thuộc G1-02), chưa upload media (thuộc G1-03).
Ca kiểm tra và expected:
- Đăng nhập đúng thông tin -> Trả về Set-Cookie session và X-CSRF-Token hợp lệ, HTTP 200 kèm thông tin user.
- Đăng nhập sai mật khẩu -> HTTP 401 UNAUTHORIZED, không lộ thông tin cụ thể tài khoản tồn tại hay không.
- Gửi POST/PATCH không có CSRF token hoặc token sai -> HTTP 403 CSRF_INVALID.
- GET /auth/me khi chưa đăng nhập -> HTTP 401 UNAUTHORIZED.
- Đăng xuất -> Xóa session cookie, vô hiệu hóa session trong DB/memory.
Lệnh kiểm tra thực tế sau khi xem package.json:
- pnpm --filter @carsharing/api run test:all
- node tools/export-openapi.mjs
Điều kiện DONE: Unit & e2e test auth pass 100%, cookie và CSRF hoạt động chuẩn xác trên môi trường cùng origin, OpenAPI cập nhật các route auth.
Kết quả/giới hạn cần ghi vào PROGRESS.md: Ghi nhận trạng thái hoàn thành G1-01, số lượng test pass, cơ chế cookie/CSRF đã xác thực.
```

---

## G1-02: Xác thực Bằng lái xe (KYC Driver License Flow)

```text
ID và tên: G1-02 Xác thực Bằng lái xe (KYC Driver License Flow)
Yêu cầu SRS/API liên quan: UC-02, Bắt buộc xác thực GPLX trước khi đặt xe; API POST /api/v1/users/me/driver-license, GET /api/v1/users/me/driver-license
Prerequisite đã DONE: G1-01
File cần đọc: docs/SRS.md, docs/API_CONTRACT.md, docs/DATABASE_DESIGN.md (bảng driver_licenses), prisma/schema.prisma
File chính dự kiến:
- apps/api/src/users/users.module.ts
- apps/api/src/users/users.controller.ts
- apps/api/src/users/users.service.ts
- apps/api/src/users/dto/submit-license.dto.ts
File liên quan bắt buộc: apps/api/src/app.module.ts, apps/api/src/auth/guards/session.guard.ts, packages/contracts/openapi.json
Kết quả cần có:
- API nộp thông tin bằng lái: số GPLX (đúng 12 chữ số chuẩn VN), họ tên, ngày sinh, hạng bằng (B1/B2 trở lên), ngày hết hạn (bắt buộc còn hạn ít nhất 30 ngày).
- Quản lý trạng thái KYC (NONE -> PENDING -> VERIFIED / REJECTED) theo đúng SRS.
- Lưu trữ liên kết với mediaObject của ảnh GPLX (được upload qua G1-03).
- Cung cấp guard/helper `KycVerifiedGuard` để chặn các hành động yêu cầu bằng lái đã duyệt.
Không mở rộng sang: Chưa xử lý đặt cọc hoặc chuyến đi (thuộc G3).
Ca kiểm tra và expected:
- Nộp GPLX hợp lệ -> Trạng thái chuyển sang PENDING, bản ghi `driver_licenses` được tạo liên kết với User.
- Nộp GPLX hết hạn hoặc số GPLX không đúng 12 số -> HTTP 400 VALIDATION_ERROR.
- Cố tình nộp lại khi đang ở trạng thái VERIFIED -> HTTP 409 CONFLICT.
- Endpoint admin/mock verify chuyển trạng thái sang VERIFIED cập nhật `verified_at` hợp lệ.
Lệnh kiểm tra thực tế sau khi xem package.json:
- pnpm --filter @carsharing/api run test:all
- node tools/export-openapi.mjs
Điều kiện DONE: Test nghiệp vụ KYC pass, ràng buộc ngày và format được kiểm chứng, cập nhật trạng thái User đồng bộ.
Kết quả/giới hạn cần ghi vào PROGRESS.md: Ghi nhận hoàn thành G1-02, xác thực định dạng GPLX và luồng chuyển trạng thái KYC.
```

---

## G1-03: Dịch vụ S3 Presigned URL & Quản lý Media Riêng tư

```text
ID và tên: G1-03 Dịch vụ S3 Presigned URL & Quản lý Media Riêng tư
Yêu cầu SRS/API liên quan: ADR-08 (Object storage, bucket private, presigned URLs), API POST /api/v1/media/presign-upload, GET /api/v1/media/:id/view-url
Prerequisite đã DONE: G1-01, G0-05 (MinIO/Silo running)
File cần đọc: infra/compose.yaml, docs/DECISIONS.md#ADR-08, docs/DATABASE_DESIGN.md (bảng media_objects), prisma/schema.prisma
File chính dự kiến:
- apps/api/src/media/media.module.ts
- apps/api/src/media/media.service.ts
- apps/api/src/media/media.controller.ts
- apps/api/src/media/dto/presign-upload.dto.ts
- apps/api/src/media/guards/media-access.guard.ts
File liên quan bắt buộc: apps/api/src/app.module.ts, packages/contracts/openapi.json
Kết quả cần có:
- Tích hợp `@aws-sdk/client-s3` và `@aws-sdk/s3-request-presigner`.
- Sinh Presigned URL PUT để client upload trực tiếp lên MinIO/Silo với giới hạn Content-Type (image/jpeg, image/png) và kích thước tối đa (5MB).
- Tạo bản ghi `media_objects` với trạng thái `PENDING` và cập nhật `VERIFIED` sau khi probe tồn tại file trên storage.
- Sinh Presigned URL GET để xem file với TTL tối đa 15 phút.
- Phân quyền nghiêm ngặt: Chỉ chủ sở hữu giấy tờ hoặc người có thẩm quyền liên quan mới được lấy link xem ảnh GPLX / đăng kiểm / bảo hiểm.
Không mở rộng sang: Chưa gắn vào checklist giao nhận xe (thuộc G4).
Ca kiểm tra và expected:
- Yêu cầu presigned upload với MIME type không hợp lệ (ví dụ: application/pdf cho ảnh đại diện) -> HTTP 400 VALIDATION_ERROR.
- Presigned upload URL cho phép PUT file nhị phân lên bucket private của MinIO thành công.
- Yêu cầu view URL của User khác đối với tài liệu nhạy cảm (GPLX) -> HTTP 403 FORBIDDEN.
- Ảnh xe công khai (PUBLIC_CAR_PHOTO) cho phép truy cập URL xem công khai.
Lệnh kiểm tra thực tế sau khi xem package.json:
- pnpm --filter @carsharing/api run test:all
- node tools/export-openapi.mjs
Điều kiện DONE: Test tương tác S3 probe pass, presigned URL upload/view hoạt động trên MinIO local, quyền riêng tư được kiểm soát 100%.
Kết quả/giới hạn cần ghi vào PROGRESS.md: Bằng chứng upload/download file qua presigned URL trên MinIO local, quyền bảo mật tài liệu nhạy cảm.
```

---

## G1-04: Đăng Ký và Quản Lý Xe Dành Cho Chủ Xe (Owner Vehicle CRUD)

```text
ID và tên: G1-04 Đăng Ký và Quản Lý Xe Dành Cho Chủ Xe (Owner Vehicle CRUD)
Yêu cầu SRS/API liên quan: UC-03, API POST /api/v1/owner/vehicles, PATCH /api/v1/owner/vehicles/:id, GET /api/v1/owner/vehicles, POST /api/v1/owner/vehicles/:id/publish
Prerequisite đã DONE: G1-01, G1-03
File cần đọc: docs/SRS.md, docs/API_CONTRACT.md, docs/DATABASE_DESIGN.md (bảng vehicles, vehicle_amenities, vehicle_calendar), apps/api/src/vehicles/*
File chính dự kiến:
- apps/api/src/vehicles/owner-vehicles.controller.ts
- apps/api/src/vehicles/owner-vehicles.service.ts
- apps/api/src/vehicles/dto/create-vehicle.dto.ts
- apps/api/src/vehicles/dto/update-vehicle.dto.ts
File liên quan bắt buộc: apps/api/src/vehicles/vehicles.module.ts, packages/contracts/openapi.json
Kết quả cần có:
- Chủ xe tạo xe mới ở trạng thái `DRAFT`: nhập hãng, model, năm sản xuất, thành phố, địa chỉ đón/trả, biển số xe (chuẩn hóa `plateNormalized`), giá thuê theo ngày (100k - 100M VND), số ghế, loại xe, tiện nghi, tính năng Keyless.
- Gắn ảnh giấy tờ xe (đăng ký, đăng kiểm, bảo hiểm bắt buộc) và tối thiểu 1 ảnh ngoại thất xe từ các mediaObject đã upload.
- Xem danh sách xe của chính mình (`GET /owner/vehicles`) kèm trạng thái (`DRAFT`, `WAITING_APPROVAL`, `PUBLISHED`, `DENIED`).
- Chuyển trạng thái xe sang `PUBLISHED` (kèm xác thực điều kiện tối thiểu: đủ giấy tờ và ảnh).
Không mở rộng sang: Chưa xử lý lịch đặt xe của khách hoặc giải quyết tranh chấp (thuộc G3 và G4).
Ca kiểm tra và expected:
- Tạo xe thành công -> Trả về HTTP 201 với trạng thái DRAFT.
- Đặt giá ngoài khoảng [100.000, 100.000.000] VND -> HTTP 400 VALIDATION_ERROR.
- Biển số xe trùng với xe đã đăng ký khác -> HTTP 409 CONFLICT.
- Yêu cầu publish xe khi chưa đủ ảnh hoặc thiếu giấy tờ -> HTTP 422 UNPROCESSABLE_ENTITY kèm lý do cụ thể.
- Người dùng A không thể sửa hoặc xem chi tiết xe nội bộ của người dùng B -> HTTP 403 FORBIDDEN.
Lệnh kiểm tra thực tế sau khi xem package.json:
- pnpm --filter @carsharing/api run test:all
- node tools/export-openapi.mjs
Điều kiện DONE: Suite test owner vehicles pass, kiểm tra quyền sở hữu chính xác, ràng buộc DB và nghiệp vụ không bị vi phạm.
Kết quả/giới hạn cần ghi vào PROGRESS.md: Ghi nhận số lượng test pass, xác minh quy trình tạo, sửa và chuyển trạng thái xe từ DRAFT sang PUBLISHED.
```

---

## G1-05: Tích Hợp Giao Diện Web Cho Auth, KYC & Quản Lý Xe

```text
ID và tên: G1-05 Tích Hợp Giao Diện Web Cho Auth, KYC & Quản Lý Xe
Yêu cầu SRS/API liên quan: UC-01, UC-02, UC-03 phía giao diện người dùng Web Next.js 16
Prerequisite đã DONE: G1-01, G1-02, G1-03, G1-04
File cần đọc: apps/web/src/app/page.tsx, packages/contracts/src/*, apps/web/src/lib/api.ts
File chính dự kiến:
- apps/web/src/components/AuthModal.tsx
- apps/web/src/components/UserNav.tsx
- apps/web/src/app/profile/kyc/page.tsx
- apps/web/src/app/owner/vehicles/page.tsx
- apps/web/src/app/owner/vehicles/new/page.tsx
- apps/web/src/lib/auth-context.tsx
File liên quan bắt buộc: apps/web/package.json, packages/contracts/src/index.ts
Kết quả cần có:
- Tái sinh types tại `packages/contracts` từ OpenAPI mới sinh của G1.
- Modal/Form đăng nhập và chuyển đổi nhanh giữa các tài khoản demo (được bảo vệ bằng cookie SameSite & CSRF token).
- Menu người dùng hiển thị họ tên, trạng thái KYC (Chưa xác thực / Đang chờ duyệt / Đã xác thực), nút Đăng xuất.
- Trang nộp bằng lái xe KYC: upload ảnh GPLX qua presigned URL trực tiếp lên MinIO và gửi thông tin về API.
- Trang quản lý xe của chủ xe: danh sách xe cá nhân, nút thêm xe mới, form nhập thông tin xe kèm upload ảnh.
Không mở rộng sang: Chưa làm luồng checkout thanh toán cọc hoặc xem hợp đồng (thuộc G3).
Ca kiểm tra và expected:
- Đăng nhập tài khoản demo trên UI -> Header hiển thị avatar, họ tên và badge tương ứng.
- Đổi trạng thái KYC trên web được phản ánh ngay sau khi reload hoặc query lại.
- Tải file ảnh lên MinIO qua S3 presigned URL thành công không bị chặn CORS.
- Form thêm xe mới hiển thị validation lỗi rõ ràng khi nhập giá sai hoặc thiếu ảnh.
Lệnh kiểm tra thực tế sau khi xem package.json:
- pnpm --filter @carsharing/contracts run build
- pnpm --filter @carsharing/web run typecheck
- pnpm --filter @carsharing/web run build
Điều kiện DONE: Next.js build Turbopack không lỗi, không import Prisma vào web, UI hiển thị mượt mà responsive tiếng Việt.
Kết quả/giới hạn cần ghi vào PROGRESS.md: Ghi nhận trạng thái hoàn thành G1-05, chụp ảnh hoặc xác nhận form KYC và form đăng ký xe chạy thật.
```

---

## G1-06: Kiểm Tra Tích Hợp Toàn Diện & Đóng Gói Milestone G1

```text
ID và tên: G1-06 Kiểm Tra Tích Hợp Toàn Diện & Đóng Gói Milestone G1
Yêu cầu SRS/API liên quan: Kiểm tra liên thông toàn bộ luồng Auth, KYC, Upload media, Quản lý xe từ Backend đến Browser
Prerequisite đã DONE: G1-01 đến G1-05
File cần đọc: docs/PROGRESS.md, apps/web/test/smoke.spec.ts, .github/workflows/ci.yml
File chính dự kiến:
- apps/web/test/auth-kyc-vehicle.spec.ts
- apps/api/test/auth-flow.e2e-spec.ts
- docs/PROGRESS.md
- README.md
File liên quan bắt buộc: package.json, pnpm-lock.yaml
Kết quả cần có:
- Suite e2e API kiểm tra toàn bộ vòng đời: Login -> Nộp KYC -> Duyệt KYC -> Tạo xe -> Upload ảnh -> Publish xe -> Xuất hiện trên GET /vehicles công khai.
- Playwright E2E browser test kịch bản người dùng thao tác trực tiếp trên trình duyệt Chromium.
- Kiểm tra bảo mật: Không rò rỉ cookie qua script (HttpOnly), không bypass được CSRF, không xem được GPLX của người khác.
- CI GitHub Actions chạy hoàn toàn xanh trên toàn bộ các bước từ install, migrate, seed, typecheck, build đến test.
- Lập danh sách task cards cho G2 (Tìm kiếm nâng cao & Mô hình tính giá hoàn chỉnh).
Không mở rộng sang: Không tự ý viết mã cho G2 trước khi được giao việc.
Ca kiểm tra và expected:
- pnpm run typecheck -> 0 lỗi.
- pnpm run build -> 3 packages biên dịch thành công.
- pnpm run test -> Tất cả các test API và constraint pass 100%.
- pnpm run test:smoke -> Playwright smoke test kịch bản G1 pass 100%.
Lệnh kiểm tra thực tế sau khi xem package.json:
- pnpm run typecheck
- pnpm run build
- pnpm run test
- pnpm run test:smoke
- pnpm run format:check
Điều kiện DONE: Có đầy đủ log thực tế của toàn bộ pipeline kiểm tra, không còn file mock tạm, tài liệu tiến độ được cập nhật chi tiết.
Kết quả/giới hạn cần ghi vào PROGRESS.md: Báo cáo nghiệm thu hoàn thành Milestone G1, log kiểm thử thực tế và đề xuất bắt đầu G2.
```
