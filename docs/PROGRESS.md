# Tiến độ triển khai Car Sharing

Baseline bàn giao ngày 27/10/2026. Cập nhật sau từng task; ghi lệnh/kết quả thực tế, không chỉ đánh dấu checklist.

## Đã có trước khi code

- SRS 1.1, quyết định nghiệp vụ, API contract, thiết kế dữ liệu và kế hoạch G0–G5.
- Ba báo cáo Word đã chỉnh sửa và bản gốc được sao lưu.
- Handoff cho Gemini và task cards G0.
- Kiểm tra tài liệu/ví dụ calculator ghi ở VERIFICATION.md; chưa có test ứng dụng.

## Task hiện tại

Task đề xuất tiếp theo: **G2-03** (Hệ Thống Mã Khuyến Mãi & Giảm Giá Voucher). Task G2-02 đã hoàn tất và được ghi nhận.

### Bảng tiến độ Milestone G2 (Tìm Kiếm Nâng Cao & Động Cơ Tính Giá)

| Task | Nội dung | Trạng thái | Bằng chứng |
| --- | --- | --- | --- |
| G2-01 | Bộ lọc & tìm kiếm xe nâng cao | DONE | Mở rộng QueryVehiclesDto (q, brand, amenities, sort: price_asc, price_desc, popularity_desc, rating_desc); VehiclesService hỗ trợ lọc keyword, brand, mảng tiện nghi bắt buộc, sorting quan hệ đếm bookings; GET /vehicles/:id trả về chi tiết xe công khai (bảo mật tuyệt đối: không lộ biển số plateNormalized và địa chỉ pickupAddress); 132 tests backend pass (46 unit, 18 constraints, 68 e2e); OpenAPI và contracts tái sinh và build thành công |
| G2-02 | Động cơ tính giá & snapshot chi phí | DONE | PricingModule, PricingService, PricingController (POST /pricing/quote, POST /pricing/calculate, GET /vehicles/:id/pricing-preview); logic tính số ngày làm tròn 24h, phụ phí cuối tuần T7/CN 10%, gói bảo hiểm BASIC/STANDARD/PREMIUM, phí dịch vụ sàn 10%, tiền cọc lũy tiến 5M/10M/15M VND; bảo đảm đẳng thức toán học total = subtotal + serviceFee + deposit khớp 100% check constraint PostgreSQL; kiểm tra xung đột lịch xe; 146 tests backend pass (53 unit, 18 constraints, 75 e2e); OpenAPI và contracts tái sinh; Playwright smoke pass |
| G2-03 | Hệ thống mã khuyến mãi & giảm giá | TODO | Lập kế hoạch chi tiết tại docs/tasks/G2_TASKS.md |
| G2-04 | Web UI chi tiết xe & dự toán giá | TODO | Lập kế hoạch chi tiết tại docs/tasks/G2_TASKS.md |
| G2-05 | Kiểm tra tích hợp & đóng gói G2 | TODO | Lập kế hoạch chi tiết tại docs/tasks/G2_TASKS.md |

### Bảng tiến độ Milestone G1 (Xác thực, KYC & Quản lý Xe - Hoàn tất 100%)

| Task | Nội dung | Trạng thái | Bằng chứng |
| --- | --- | --- | --- |
| G1-01 | Nền tảng Xác thực (Cookies, CSRF, Auth) | DONE | AuthModule, cookie HttpOnly (access 15m, refresh 7d), Double Submit CSRF token (X-CSRF-Token), SessionGuard, CsrfGuard, CurrentUser decorator, Google OIDC callback, capability model (RENTER + OWNER); 68 tests pass (19 unit, 18 constraints, 31 e2e); Playwright smoke pass |
| G1-02 | Xác thực Bằng lái xe (KYC) | DONE | UsersModule, migration 20261027064407_add_driver_licenses_kyc áp dụng dev/test DB; check constraints PostgreSQL (đúng 12 số GPLX, tuổi >= 18, hạn >= 30 ngày, status PENDING -> VERIFIED/REJECTED, chặn nộp lại khi VERIFIED 409); KycVerifiedGuard; 81 tests pass; Playwright smoke pass |
| G1-03 | Dịch vụ S3 Presigned URL | DONE | MediaModule, tích hợp @aws-sdk/client-s3 & @aws-sdk/s3-request-presigner, POST /media/upload-intents (presigned PUT, TTL 15m, giới hạn 5MB, JPEG/PNG), upload trực tiếp lên MinIO private bucket, POST /media/:id/verify (S3 HeadObject probe, move staging sang finalized, state VERIFIED), GET /media/:id/read-url (presigned GET URL, chặn tài liệu nhạy cảm GPLX 403, mở ảnh xe công khai); 98 tests pass (33 unit, 18 constraints, 47 e2e) |
| G1-04 | Đăng ký & quản lý xe chủ xe | DONE | OwnerVehiclesController & Service, POST /owner/vehicles (trạng thái DRAFT, chuẩn hóa biển số plateNormalized, chặn trùng biển số 409, kiểm tra khoảng giá 100k-100M VND, liên kết tiện nghi và ảnh xe VERIFIED), GET /owner/vehicles (danh sách xe cá nhân kèm biển số và địa chỉ đón trả), GET /owner/vehicles/:id (bảo mật 403 nếu không phải chủ xe), PATCH /owner/vehicles/:id (cập nhật thông tin và tăng version concurrency), POST /owner/vehicles/:id/publish (yêu cầu tối thiểu 1 ảnh xe 422 PUBLISH_REQUIREMENTS_NOT_MET, chuyển PUBLISHED và xuất hiện trên public GET /vehicles không lộ biển số); 115 tests pass (40 unit, 18 constraints, 57 e2e) |
| G1-05 | Web UI Auth, KYC & Quản lý xe | DONE | AuthProvider context, AuthModal (1-click quick login demo & standard form), UserNav (avatar, tên, badge KYC, menu dropdown), /profile/kyc (form nộp GPLX, upload ảnh trực tiếp lên MinIO qua S3 presigned URL, hiển thị thẻ hồ sơ GPLX), /owner/vehicles (bảng điều khiển xe cá nhân, gắn thẻ trạng thái DRAFT/PUBLISHED, nút publish xe), /owner/vehicles/new (form đăng ký xe mới, chọn tiện nghi, upload nhiều ảnh lên S3); 0 import Prisma; Next.js Turbopack build 100% không lỗi; Playwright smoke pass |
| G1-06 | Kiểm tra tích hợp & đóng gói G1 | DONE | Toàn bộ 115 tests backend pass (40 unit, 18 constraints, 57 e2e); Playwright E2E browser tests pass trên Chromium (smoke.spec.ts + auth-kyc-vehicle.spec.ts: login -> check KYC -> logout -> switch owner -> view vehicle dashboard); typecheck 3/3 packages 0 lỗi; format:check 100% pass; lập bộ task cards G2_TASKS.md |

### Bảng tiến độ Milestone G0 (Baseline Kiến Trúc & Dữ Liệu - Hoàn tất 100%)

| Task | Nội dung | Trạng thái | Bằng chứng |
| --- | --- | --- | --- |
| G0-00 | Môi trường và phiên bản | DONE | Đã kiểm tra thực tế máy host & ghim bộ phiên bản tại docs/TECH_STACK.md |
| G0-01 | Workspace và baseline | DONE | package.json, pnpm-lock.yaml, pnpm-workspace.yaml, tsconfig.base.json, .env.example, git baseline |
| G0-02 | NestJS và health | DONE | apps/api scaffold, GET /api/v1/health liveness, build/typecheck & unit/e2e smoke test pass |
| G0-03 | Request và error contract | DONE | RequestIdMiddleware, TransformInterceptor, HttpExceptionFilter, 19 ca test unit & e2e pass |
| G0-04 | Next.js và cùng origin | DONE | Next.js 16 App Router, cùng origin rewrite /api/v1/health, build/typecheck & gọi health thực tế |
| G0-05 | PostgreSQL/storage local | DONE | Docker Compose (Postgres 18 & MinIO/Silo), btree_gist trên dev/test DB, private bucket & upload/download probe pass |
| G0-06 | Prisma schema | DONE | prisma/schema.prisma bao phủ 18 bảng, enums, timestamptz, bigint, UUID, relations; prisma validate & generate thành công |
| G0-07 | Migration/constraints | DONE | Migration áp dụng dev/test DB; 18 integration tests pass: GiST exclusion, touching, partial indexes, business checks |
| G0-08 | Seed/database provider | DONE | prisma/seed.ts idempotent (4 users, 13 vehicles, 4 bookings, calendar); PrismaService/Module tích hợp; health readiness phản ánh DB thật |
| G0-09 | API đọc xe và OpenAPI | DONE | GET /vehicles và /vehicle-options; bộ lọc, phân trang, sort, calendar conflict, bảo mật thông tin riêng tư; OpenAPI sinh tại packages/contracts/openapi.json; 49 tests pass |
| G0-10 | Contract client và UI danh sách | DONE | packages/contracts sinh type từ OpenAPI thật; web API client gọi qua same-origin proxy; UI hiển thị danh sách xe, filter, pagination, loading skeleton, empty state, error state; 0 import Prisma |
| G0-11 | CI và kiểm tra G0 | DONE | Root scripts (build, typecheck, test, test:smoke, format); 49 tests API/constraints pass; Playwright browser smoke test pass trên Chromium (8.3s); .github/workflows/ci.yml hoàn chỉnh |
| G0-12 | Review và chuẩn bị G1 | DONE | Đối chiếu 100% tài liệu & mã nguồn thực tế; bảo toàn báo cáo Word; 0 mock data giả lập; lập 6 task cards G1 tại docs/tasks/G1_TASKS.md |

TODO: chưa bắt đầu. IN_PROGRESS: đang thực hiện. BLOCKED: thiếu điều kiện cụ thể, ghi rõ. DONE: toàn bộ điều kiện bắt buộc đạt và có bằng chứng. Không đổi DONE chỉ vì đã viết xong file.

## Nhật ký mỗi task

```text
Ngày: 27/10/2026
Task: G2-02 — Động Cơ Tính Giá & Snapshot Chi Phí Thuê Xe (Pricing Engine & Snapshot)
Trạng thái: DONE
Prerequisite: G2-01
Files thay đổi:
- apps/api/src/pricing/dto/calculate-pricing.dto.ts (CalculatePricingDto, PricingPreviewQueryDto, InsurancePackageTier enum)
- apps/api/src/pricing/dto/quote.dto.ts (QuoteDto, PricingBreakdownDto, VehiclePricingSummaryDto)
- apps/api/src/pricing/pricing.service.ts (Tính số ngày làm tròn trần 24h, tính phụ phí cuối tuần T7/CN 10%, tính phí gói bảo hiểm, tính phí dịch vụ sàn 10%, tính tiền cọc lũy tiến theo giá thuê, bảo đảm đẳng thức toán học total = subtotal + serviceFee + deposit khớp 100% check constraint DB, kiểm tra xung đột lịch xe với vehicle_calendar)
- apps/api/src/pricing/pricing.controller.ts (POST /pricing/quote và POST /pricing/calculate trả về @HttpCode 200, GET /vehicles/:id/pricing-preview)
- apps/api/src/pricing/pricing.module.ts (Đăng ký PricingModule vào AppModule)
- apps/api/src/pricing/pricing.service.spec.ts (7 unit tests kiểm tra: 1 ngày cơ bản, làm tròn 24h, phụ phí cuối tuần, gói bảo hiểm, tiền cọc, khoảng thời gian không hợp lệ 422, xe không tồn tại 404)
- apps/api/test/pricing.e2e-spec.ts (7 e2e tests kiểm tra: POST /pricing/quote 200, POST /pricing/calculate 200, GET /vehicles/:id/pricing-preview 200, kiểm tra xe bận 200 available=false, 400 validation error, 404 not found)
- tools/export-openapi.mjs & packages/contracts (Tái sinh openapi.json, sinh schema.ts và export Quote, PricingBreakdown, CalculatePricingPayload, QuoteResponse)
- apps/web/src/lib/api.ts (Thêm calculateQuoteApi và fetchPricingPreviewApi có type an toàn)
Lệnh thực hiện:
- pnpm --filter @carsharing/api test -> 53/53 unit tests pass
- pnpm --filter @carsharing/api test:constraints -> 18/18 PostgreSQL integration tests pass
- pnpm --filter @carsharing/api test:e2e -> 75/75 e2e tests pass (146 tests backend pass 100%)
- pnpm --filter @carsharing/web test:smoke -> 2/2 browser tests pass (10.0s)
- pnpm run typecheck -> 0 lỗi TypeScript trên 3 packages
- pnpm run format:check -> All matched files use Prettier code style
Kết quả: Hoàn thành toàn diện Task G2-02. Động cơ tính giá chuẩn xác từng đồng VND, sẵn sàng làm nền tảng cho voucher khuyến mãi và tạo booking đặt xe.
```

```text
Ngày: 27/10/2026
Task: G2-01 — Bộ Lọc & Tìm Kiếm Xe Nâng Cao (Search & Filter Engine)
Trạng thái: DONE
Prerequisite: G1-06
Files thay đổi:
- apps/api/src/vehicles/dto/query-vehicles.dto.ts (Bổ sung tham số tìm kiếm từ khóa q, hãng xe brand, mảng tiện nghi amenities, sort đa chiều POPULARITY_DESC và RATING_DESC)
- apps/api/src/vehicles/dto/vehicle-detail.dto.ts (Tạo VehicleDetailDto và VehicleOwnerSummaryDto cho endpoint xem chi tiết xe công khai)
- apps/api/src/common/pipes/parse-uuid.pipe.ts (Tạo ParseUuidPipe kiểm tra 128-bit hex UUID tương thích toàn diện với cả seed UUID và RFC4122 v4 UUID)
- apps/api/src/common/index.ts (Xuất ParseUuidPipe)
- apps/api/src/vehicles/vehicles.service.ts (Hiện thực logic tìm kiếm OR chứa từ khóa brand/model, lọc brand chính xác, lọc mảng amenities bắt buộc qua quan hệ some, sắp xếp theo đếm quan hệ bookings, và phương thức getVehicleById bảo mật 100%: không lộ plateNormalized, pickupAddress, email, phone)
- apps/api/src/vehicles/vehicles.controller.ts (Thêm endpoint GET /api/v1/vehicles/:id có ParseUuidPipe, OpenAPI schema VehicleDetailDto)
- apps/api/src/vehicles/vehicles.service.spec.ts (6 unit tests kiểm tra tìm kiếm q, amenities, sort, validate ngày, 404 cho xe không tồn tại và kiểm tra rò rỉ bảo mật)
- apps/api/test/vehicles-search.e2e-spec.ts (11 e2e tests kiểm tra toàn bộ luồng tìm kiếm nâng cao: keyword q, brand, price range, amenities, price_asc, price_desc, popularity_desc, GET /vehicles/:id thành công, chặn xe DRAFT 404, UUID không tồn tại 404, UUID sai định dạng 400)
- tools/export-openapi.mjs & packages/contracts (Tái sinh openapi.json, sinh schema.ts và xuất types VehicleDetail, GetVehicleDetailResponse)
- apps/web/src/lib/api.ts (Mở rộng VehicleSearchParams và export fetchVehicleById)
Lệnh thực hiện:
- pnpm --filter @carsharing/api test -> 46/46 unit tests pass
- pnpm --filter @carsharing/api test:constraints -> 18/18 PostgreSQL integration tests pass
- pnpm --filter @carsharing/api test:e2e -> 68/68 e2e tests pass (132 tests backend pass 100%)
- pnpm --filter @carsharing/web test:smoke -> 2/2 browser tests pass (9.4s)
- pnpm run typecheck -> 0 lỗi TypeScript trên 3 packages
- pnpm run format:check -> All matched files use Prettier code style
Kết quả: Hoàn thành toàn diện Task G2-01. Bộ lọc tìm kiếm xe hoạt động chính xác với đầy đủ tiêu chí, endpoint chi tiết xe GET /vehicles/:id bảo mật tuyệt đối thông tin nhạy cảm.
```

```text
Ngày: 27/10/2026
Task: G1-06 — Kiểm Tra Tích Hợp Toàn Diện & Đóng Gói Milestone G1
Trạng thái: DONE
Prerequisite: G1-01, G1-02, G1-03, G1-04, G1-05
Files thay đổi:
- apps/web/src/components/AuthModal.tsx (Tối ưu hóa render modal dùng createPortal ra document.body tránh bị giới hạn bới header backdrop-filter stacking context, đồng bộ tên tài khoản demo với seed)
- apps/web/test/auth-kyc-vehicle.spec.ts (Playwright test kịch bản người dùng toàn diện: Đăng nhập renter1 -> kiểm tra badge KYC -> truy cập /profile/kyc -> đăng xuất -> đăng nhập owner1 -> truy cập /owner/vehicles quản lý xe)
- docs/tasks/G2_TASKS.md (Soạn thảo chi tiết 5 task cards cho Milestone G2: Tìm kiếm nâng cao, Động cơ tính giá, Khuyến mãi & Voucher, Web UI chi tiết xe & dự toán giá, Đóng gói G2)
- docs/PROGRESS.md (Cập nhật tiến độ nghiệm thu hoàn thành 100% Milestone G1, lập bảng Milestone G2 và ghi nhận bằng chứng thực tế)
Lệnh thực hiện:
- pnpm --filter @carsharing/web build -> Thành công, Next.js 16 App Router prerendered 5 static routes không lỗi
- pnpm --filter @carsharing/web test:smoke -> 2/2 tests pass (smoke.spec.ts + auth-kyc-vehicle.spec.ts, thời gian chạy 8.9s)
- pnpm --filter @carsharing/api test -> 40/40 unit tests pass (Auth, KYC, Media, OwnerVehicles, Health, Vehicles, Filters, Interceptors, Middleware)
- pnpm --filter @carsharing/api test:constraints -> 18/18 PostgreSQL integration tests pass (GiST exclusion no_overlap, partial unique indexes, business checks)
- pnpm --filter @carsharing/api test:e2e -> 57/57 e2e tests pass (Auth, KYC, Media, OwnerVehicles, Health, Vehicles, Request/Error contract)
- pnpm run typecheck -> 0 lỗi TypeScript trên cả 3 packages (api, web, contracts)
- pnpm run format:check -> All matched files use Prettier code style
Kết quả: Milestone G1 hoàn thành 100% với 115 tests backend và 2 browser e2e tests xanh hoàn toàn. Toàn bộ logic xác thực, bảo mật CSRF/HttpOnly, S3 presigned upload, KYC bằng lái xe và CRUD xe chủ xe đều hoạt động thông suốt từ frontend Next.js đến backend NestJS và PostgreSQL/MinIO.
```

```text
Ngày: 27/10/2026
Task: G1-05 — Tích Hợp Giao Diện Web Cho Auth, KYC & Quản Lý Xe
Trạng thái: DONE
Prerequisite: G1-01, G1-02, G1-03, G1-04
Files thay đổi:
- packages/contracts/openapi.json & schema.ts (Tái sinh types toàn bộ endpoints Auth, KYC, Media, Owner Vehicles)
- packages/contracts/src/index.ts (Xuất types alias typed client cho Web)
- apps/web/src/lib/api.ts (Mở rộng client: fetchCsrfToken, loginApi, logoutApi, fetchCurrentUser, fetchDriverLicense, submitDriverLicense, createUploadIntent, uploadToPresignedUrl, verifyMedia, fetchOwnerVehicles, createVehicle, publishVehicle)
- apps/web/src/lib/auth-context.tsx (AuthProvider quản lý phiên, cookie HttpOnly, x-csrf-token, kycStatus)
- apps/web/src/components/AuthModal.tsx (Modal đăng nhập 1-click tài khoản demo renter1/owner1/owner2 và đăng nhập thủ công)
- apps/web/src/components/UserNav.tsx (Header user avatar, badge KYC đa trạng thái, menu chuyển nhanh trang hồ sơ & đăng xe)
- apps/web/src/app/layout.tsx (Bao bọc AuthProvider toàn ứng dụng)
- apps/web/src/app/page.tsx (Gắn UserNav lên header trang chủ cạnh liveness status)
- apps/web/src/app/profile/kyc/page.tsx (Trang hồ sơ bằng lái xe: upload ảnh GPLX trực tiếp lên MinIO qua S3 presigned URL, gửi thông tin và hiển thị trạng thái duyệt PENDING/VERIFIED/REJECTED)
- apps/web/src/app/owner/vehicles/page.tsx (Trang quản lý xe của chủ xe: danh sách xe cá nhân, biển số, địa chỉ, trạng thái DRAFT/PUBLISHED, nút publish xe)
- apps/web/src/app/owner/vehicles/new/page.tsx (Form đăng ký xe mới: đầy đủ thông số kỹ thuật, checkbox Keyless, tiện nghi, upload nhiều ảnh lên S3)
Lệnh kiểm tra thực tế:
- pnpm --filter @carsharing/web run typecheck (0 lỗi TypeScript)
- pnpm --filter @carsharing/web run build (Next.js 16 Turbopack build thành công 5 routes tĩnh)
- pnpm --filter @carsharing/web run test:smoke (Playwright smoke test pass trên Chromium 7.9s)
- pnpm run format (Prettier format toàn workspace)
Ghi chú kiến trúc & an toàn:
- Không import bất kỳ file nào từ @prisma/client hay apps/api vào web frontend.
- Tải file ảnh thực hiện trực tiếp giữa Browser và MinIO S3 qua Presigned PUT URL, không tải qua API backend giúp tiết kiệm băng thông và tối ưu hiệu năng.
```

```text
Ngày: 27/10/2026
Task: G1-04 — Đăng Ký và Quản Lý Xe Dành Cho Chủ Xe (Owner Vehicle CRUD)
Trạng thái: DONE
Prerequisite: G1-01, G1-03
Files thay đổi:
- apps/api/src/vehicles/dto/owner-vehicle.dto.ts (CreateVehicleDto, UpdateVehicleDto, OwnerVehicleDto, chuẩn hóa biển số xe normalizePlate)
- apps/api/src/vehicles/owner-vehicles.service.ts (Service CRUD xe của chủ xe: tạo xe DRAFT, kiểm tra trùng biển số 409, validate ảnh xe VERIFIED, cập nhật xe, kiểm tra quyền sở hữu 403, kiểm tra điều kiện publish có ít nhất 1 ảnh 422 PUBLISH_REQUIREMENTS_NOT_MET)
- apps/api/src/vehicles/owner-vehicles.controller.ts (POST /owner/vehicles, GET /owner/vehicles, GET /owner/vehicles/:id, PATCH /owner/vehicles/:id, POST /owner/vehicles/:id/publish)
- apps/api/src/vehicles/vehicles.module.ts (Đăng ký OwnerVehiclesController, OwnerVehiclesService, liên kết AuthModule)
- apps/api/src/vehicles/owner-vehicles.service.spec.ts (7 ca unit tests kiểm tra normalize plate, duplicate conflict, unverified photo check, ownership check, publish photo requirement)
- apps/api/test/owner-vehicles.e2e-spec.ts (10 ca e2e tests toàn bộ vòng đời tạo xe DRAFT, quản lý danh sách, bảo mật quyền xem 403, gắn ảnh và publish thành công sang danh mục công khai)
- packages/contracts/openapi.json (Tái xuất OpenAPI chứa toàn bộ owner vehicle endpoints)
Lệnh kiểm tra thực tế:
- pnpm --filter @carsharing/api run test (40 unit tests pass)
- pnpm --filter @carsharing/api run test:e2e (57 e2e tests pass)
- pnpm --filter @carsharing/api run test:all (115 tests pass: 40 unit, 18 constraints, 57 e2e)
- node tools/export-openapi.mjs (Xuất OpenAPI thành công)
- pnpm --filter @carsharing/contracts run build (Build contracts thành công)
- pnpm run format (Prettier format toàn workspace)
Ghi chú bảo mật & nghiệp vụ:
- Concurrency versioning: Mỗi lần PATCH hoặc Publish xe, trường version được tăng tự động.
- Biển số xe plateNormalized và địa chỉ đón trả pickupAddress chỉ trả về cho chính chủ xe qua /owner/vehicles; public GET /vehicles che giấu 100%.
```

```text
Ngày: 27/10/2026
Task: G1-03 — Dịch vụ S3 Presigned URL & Quản lý Media Riêng tư
Trạng thái: DONE
Prerequisite: G1-01, G0-05
Files thay đổi:
- apps/api/src/config/env.validation.ts (Cấu hình S3_ENDPOINT, S3_REGION, S3_BUCKET_PRIVATE, S3_ACCESS_KEY, S3_SECRET_KEY)
- apps/api/src/media/dto/media.dto.ts (CreateUploadIntentDto, UploadIntentResponseDto, MediaReadUrlResponseDto, MediaObjectDto, giới hạn MIME JPEG/PNG và size <= 5 MiB)
- apps/api/src/media/media.service.ts (Tích hợp @aws-sdk/client-s3 và @aws-sdk/s3-request-presigner: createUploadIntent, verifyMedia probe HeadObject S3 & copy staging sang finalized, getReadUrl kiểm soát quyền riêng tư)
- apps/api/src/auth/guards/optional-session.guard.ts (OptionalSessionGuard nạp request.user nếu có token nhưng không bắt buộc)
- apps/api/src/media/media.controller.ts (POST /media/upload-intents, POST /media/:id/verify, GET /media/:id/read-url)
- apps/api/src/media/media.module.ts (Module xuất MediaService và liên kết AuthModule, PrismaModule, ConfigModule)
- apps/api/src/app.module.ts (Đăng ký MediaModule)
- apps/api/src/media/media.service.spec.ts (7 ca unit test MediaService pass 100%)
- apps/api/test/media.e2e-spec.ts (10 ca e2e test luồng presigned PUT, upload MinIO thực tế, probe verify, bảo mật 403 tài liệu nhạy cảm và mở công khai ảnh xe)
- packages/contracts/openapi.json (Tái xuất OpenAPI chứa đầy đủ endpoints media)
Lệnh kiểm tra thực tế:
- pnpm --filter @carsharing/api run test (33 unit tests pass)
- pnpm --filter @carsharing/api run test:e2e (47 e2e tests pass)
- pnpm --filter @carsharing/api run test:all (98 tests pass: 33 unit, 18 constraints, 47 e2e)
- node tools/export-openapi.mjs (Xuất OpenAPI thành công)
- pnpm --filter @carsharing/contracts run build (Build contracts thành công)
- pnpm run format (Prettier format toàn workspace)
Ghi chú bảo mật & giới hạn:
- Toàn bộ media upload qua Presigned URL trực tiếp lên bucket private của MinIO, backend không làm proxy tải file nhị phân.
- Quyền riêng tư: Giấy tờ định danh (IDENTITY_DOCUMENT) bắt buộc kiểm tra uploaderId == currentUser.id, trả về 403 Forbidden cho bất kỳ người dùng nào khác.
```

```text
Ngày: 27/10/2026
Task: G1-02 — Xác thực Bằng lái xe (KYC Driver License Flow)
Trạng thái: DONE
Prerequisite: G1-01
Files thay đổi:
- prisma/schema.prisma (Thêm enum KycStatus [NONE, PENDING, VERIFIED, REJECTED] và model DriverLicense liên kết User 1-1)
- prisma/migrations/20261027064407_add_driver_licenses_kyc/migration.sql (Migration tạo bảng driver_licenses, enum KycStatus, check constraints: 12 số GPLX, expiry > dob, verified_at đồng bộ với status)
- apps/api/src/users/dto/submit-license.dto.ts (Định nghĩa SubmitDriverLicenseDto, VerifyDriverLicenseDto, DriverLicenseDto với allowlist hạng GPLX và validation)
- apps/api/src/users/users.service.ts (Service xử lý nộp GPLX, kiểm tra hạn >= 30 ngày, tuổi >= 18, chặn nộp lại khi đã VERIFIED, duyệt/từ chối KYC)
- apps/api/src/users/guards/kyc-verified.guard.ts (Guard chặn các hành động yêu cầu bằng lái đã duyệt KYC_REQUIRED)
- apps/api/src/users/users.controller.ts (Controller cung cấp GET /users/me/driver-license, POST /users/me/driver-license, POST /users/:id/driver-license/verify)
- apps/api/src/users/users.module.ts (Module Users xuất UsersService và KycVerifiedGuard)
- apps/api/src/app.module.ts (Đăng ký UsersModule vào ứng dụng)
- apps/api/src/main.ts (Cấu hình Swagger tag Users)
- tools/export-openapi.mjs (Cập nhật Swagger tag Users)
- packages/contracts/openapi.json & src/schema.ts (Cập nhật OpenAPI schema và types tự động)
- packages/contracts/src/index.ts (Xuất DriverLicense, SubmitDriverLicensePayload, VerifyDriverLicensePayload, DriverLicenseResponse)
- apps/api/src/users/users.service.spec.ts (Unit tests kiểm tra toàn diện nghiệp vụ xác minh GPLX)
- apps/api/test/driver-license.e2e-spec.ts (7 ca test E2E kiểm tra nộp GPLX, kiểm tra 12 số, kiểm tra thời hạn, kiểm tra CSRF token, duyệt VERIFIED và chặn nộp lại 409)
- docs/PROGRESS.md (Cập nhật tiến độ hoàn thành G1-02)
Lệnh đã chạy và kết quả:
- pnpm exec prisma migrate deploy: Áp dụng migration sạch vào cả dev database carsharing_dev và test database carsharing_test.
- pnpm --filter @carsharing/api run build: Biên dịch NestJS API đạt 0 lỗi.
- node tools/export-openapi.mjs: Xuất schema OpenAPI v1.1 bao gồm đầy đủ endpoint Users / Driver License vào packages/contracts/openapi.json.
- pnpm --filter @carsharing/contracts run generate && build: Tái sinh types TypeScript và biên dịch contracts thành công.
- pnpm --filter @carsharing/api run test:all: Toàn bộ 81/81 tests (25 unit, 18 DB constraints, 38 e2e) pass 100% trong 8.9 giây (exit 0).
  + GET /api/v1/users/me/driver-license trả về hồ sơ GPLX của user.
  + POST /api/v1/users/me/driver-license kiểm tra CSRF token, định dạng 12 số GPLX, thời hạn ít nhất 30 ngày.
  + POST /api/v1/users/:id/driver-license/verify duyệt chuyển trạng thái sang VERIFIED cập nhật verifiedAt.
  + Cố tình gửi lại khi đã VERIFIED trả về đúng HTTP 409 ALREADY_VERIFIED.
- pnpm run test:smoke: Playwright browser smoke test trên Chromium pass 100% trong 7.2 giây (exit 0).
- pnpm run typecheck: Kiểm tra kiểu tĩnh toàn bộ 3 packages trong workspace đạt 0 lỗi (exit 0).
- pnpm run format:check: Toàn bộ workspace khớp quy tắc Prettier (exit 0).
Ca chưa chạy và lý do: Chưa nộp ảnh chụp GPLX nhị phân trực tiếp lên S3 (thuộc G1-03).
Quyết định mới/ảnh hưởng hợp đồng: Không thay đổi hợp đồng. Định nghĩa chuẩn hóa trạng thái KYC theo đúng SRS.
Commit hoặc điểm lưu diff nếu có: Sẽ commit sau khi lưu log tiến độ.
```

```text
Ngày: 27/10/2026
Task: G1-01 — Nền tảng Xác thực (Session Cookies, CSRF, AuthModule)
Trạng thái: DONE
Prerequisite: G0-12
Files thay đổi:
- apps/api/package.json (Thêm cookie-parser, bcryptjs, jsonwebtoken và type definitions)
- apps/api/src/config/env.validation.ts (Bổ sung JWT_ACCESS_SECRET và JWT_REFRESH_SECRET)
- apps/api/src/auth/dto/auth.dto.ts (Định nghĩa LoginDto, RegisterDto, UserDto, AuthResponseDto, CsrfResponseDto với Swagger annotations)
- apps/api/src/auth/decorators/public-csrf.decorator.ts (@PublicCsrf cho phép miễn kiểm tra CSRF trước khi có phiên)
- apps/api/src/auth/decorators/current-user.decorator.ts (@CurrentUser trích xuất thông tin user từ request context)
- apps/api/src/auth/auth.service.ts (Service xác thực: bcrypt băm mật khẩu, ký JWT access 15m/refresh 7d, lưu RefreshSession vào PostgreSQL, sinh CSRF token an toàn, capability model RENTER+OWNER)
- apps/api/src/auth/guards/session.guard.ts (Guard bảo vệ route bằng cookie HttpOnly hoặc Authorization Bearer header)
- apps/api/src/auth/guards/csrf.guard.ts (Guard chống tấn công CSRF qua cơ chế Double Submit Token header X-CSRF-Token cho POST/PUT/PATCH/DELETE)
- apps/api/src/auth/auth.controller.ts (Controller cung cấp GET /auth/csrf, POST /auth/login, POST /auth/register, GET /auth/google, GET /auth/google/callback, POST /auth/logout, GET /auth/me và GET /me)
- apps/api/src/auth/auth.module.ts (Module Auth xuất AuthService, SessionGuard, CsrfGuard)
- apps/api/src/app.module.ts (Đăng ký AuthModule vào ứng dụng)
- apps/api/src/main.ts (Cấu hình app.use(cookieParser()) và Swagger tag Auth)
- prisma/seed.ts (Cập nhật mật khẩu chuẩn bcrypt cho 4 tài khoản seed: DemoPassword123!)
- tools/export-openapi.mjs (Cập nhật xuất OpenAPI bao gồm các route Auth)
- packages/contracts/openapi.json & src/schema.ts (Cập nhật hợp đồng OpenAPI và types tự động)
- packages/contracts/src/index.ts (Xuất các type User, AuthResponse, CsrfResponse, LoginResponse, RegisterResponse)
- apps/api/src/auth/auth.service.spec.ts (Unit tests kiểm tra toàn bộ logic nghiệp vụ AuthService)
- apps/api/test/auth.e2e-spec.ts (12 ca test E2E kiểm tra đăng ký, đăng nhập, bảo vệ CSRF, cookie HttpOnly, Google callback, logout và thu hồi phiên)
- docs/PROGRESS.md (Cập nhật tiến độ hoàn thành G1-01)
Lệnh đã chạy và kết quả:
- pnpm --filter @carsharing/api run build: Biên dịch NestJS API đạt 0 lỗi.
- node tools/export-openapi.mjs: Xuất schema OpenAPI v1.1 bao gồm đầy đủ 7 endpoint Auth vào packages/contracts/openapi.json.
- pnpm --filter @carsharing/contracts run generate && build: Tái sinh types TypeScript và biên dịch contracts thành công.
- pnpm --filter @carsharing/api run test:all: Toàn bộ 68/68 tests (19 unit, 18 DB constraints, 31 e2e) pass 100% trong 5.9 giây (exit 0).
  + GET /api/v1/auth/csrf cấp mã CSRF và đặt cookie csrf_token.
  + POST /api/v1/auth/login đăng nhập thành công tài khoản seed owner1@carsharing.local với mật khẩu DemoPassword123!, trả về đúng UserDto với capability ['RENTER', 'OWNER'], đặt cookie HttpOnly access_token và refresh_token.
  + POST /api/v1/auth/login từ chối mật khẩu sai với HTTP 401 INVALID_CREDENTIALS không lộ trạng thái tài khoản.
  + GET /api/v1/auth/me trả về 401 khi chưa có cookie, trả về 200 thông tin user khi có cookie phiên hợp lệ.
  + POST /api/v1/auth/logout chặn request thiếu X-CSRF-Token (HTTP 403 CSRF_INVALID), đăng xuất thành công khi có đủ token và xóa sạch cookie phiên.
  + POST /api/v1/auth/register tạo tài khoản mới thành công, chặn email trùng với HTTP 409 EMAIL_IN_USE.
- pnpm run test:smoke: Playwright browser smoke test trên Chromium pass 100% trong 8.8 giây (exit 0).
- pnpm run typecheck: Kiểm tra kiểu tĩnh toàn bộ 3 packages trong workspace đạt 0 lỗi (exit 0).
- pnpm run format:check: Toàn bộ workspace khớp quy tắc Prettier (exit 0).
Ca chưa chạy và lý do: Chưa nộp ảnh giấy phép lái xe KYC (thuộc G1-02).
Quyết định mới/ảnh hưởng hợp đồng: Không thay đổi hợp đồng. Thực hiện đúng ADR-03, ADR-04 và ADR-16.
Commit hoặc điểm lưu diff nếu có: Sẽ commit sau khi lưu log tiến độ.
```

```text
Ngày: 27/10/2026
Task: G0-12 — Review trước khi chuyển G1
Trạng thái: DONE
Prerequisite: G0-11
Files thay đổi:
- docs/tasks/G1_TASKS.md (Khởi tạo tài liệu 6 task cards chi tiết cho Milestone G1: G1-01 Auth, G1-02 KYC, G1-03 S3 Media, G1-04 Owner Vehicles, G1-05 Web UI, G1-06 Integration & E2E)
- docs/TECH_STACK.md (Cập nhật phiên bản thực tế đã kiểm chứng: pgsty/silo cho MinIO, @playwright/test 1.64.1 cho smoke test)
- README.md (Cập nhật liên kết tài liệu G1_TASKS.md và bảng hướng dẫn vận hành hệ thống)
- docs/PROGRESS.md (Ghi nhận hoàn thành Milestone G0 100%, sẵn sàng chuyển sang G1)
Lệnh đã chạy và kết quả:
- Đối chiếu toàn diện hiện trạng workspace:
  + Không tồn tại module giả lập (mock stubs) đóng vai trò thay thế tính năng chưa viết.
  + Dữ liệu seed 100% đi từ PostgreSQL 18 qua Prisma -> NestJS 12 -> Next.js 16.
  + Cơ chế bảo mật dữ liệu: Tuyệt đối không lộ biển số xe (plateNormalized), địa chỉ chính xác (pickupAddress) hay giấy tờ cá nhân trên public API và web DOM.
  + Không rò rỉ token/mật khẩu trong log lỗi hệ thống (HttpExceptionFilter đã kiểm chứng che giấu 500).
  + Ranh giới phân tầng: Tuyệt đối không import Prisma vào frontend apps/web.
  + Bảo toàn nguyên vẹn: Toàn bộ 3 file báo cáo Word và thư mục backups/2026-10-27-originals được giữ nguyên.
- Kiểm tra chu trình fresh setup:
  + pnpm run format:check -> Pass 100%.
  + pnpm run typecheck -> Pass 100% trên cả 3 packages.
  + pnpm run build -> Biên dịch thành công 100%.
  + pnpm run test -> 49/49 tests backend pass 100%.
  + pnpm run test:smoke -> Playwright browser smoke test pass 100% trên Chromium.
Ca chưa chạy và lý do: Không có.
Quyết định mới/ảnh hưởng hợp đồng: Không thay đổi hợp đồng. Chỉ chuẩn bị task cards cho G1, không tự ý viết mã Auth/G1 trước khi có yêu cầu.
Commit hoặc điểm lưu diff nếu có: Sẽ commit sau khi lưu log tiến độ.
```

```text
Ngày: 27/10/2026
Task: G0-11 — Kiểm tra xuyên suốt và CI baseline
Trạng thái: DONE
Prerequisite: G0-07, G0-10
Files thay đổi:
- package.json (Định nghĩa các script toàn diện cho workspace: build, typecheck, test, test:smoke, format, format:check)
- apps/web/package.json (Thêm @playwright/test và script test:smoke)
- apps/web/playwright.config.ts (Cấu hình Playwright tự động quản lý vòng đời khởi chạy NestJS backend tại port 4000 và Next.js web tại port 3000)
- apps/web/test/smoke.spec.ts (Bộ test Playwright trình duyệt: xác nhận tải trang, nhận danh sách xe thật từ DB, kiểm tra ẩn dữ liệu riêng tư, bộ lọc thành phố, checkbox Keyless, nút reset bộ lọc)
- .github/workflows/ci.yml (Workflow CI GitHub Actions hoàn chỉnh: chạy trên ubuntu-latest với services Postgres 18 & MinIO/Silo, btree_gist extension, Prisma migration deploy, seed, format:check, typecheck, build, test và Playwright smoke test)
- README.md (Cập nhật hướng dẫn vận hành workspace, các lệnh kiểm tra và trạng thái hoàn thành G0)
- docs/PROGRESS.md (Cập nhật tiến độ hoàn thành G0-11)
Lệnh đã chạy và kết quả:
- pnpm run typecheck: Chạy kiểm tra kiểu tĩnh song song cả 3 packages (contracts, api, web) đạt 0 lỗi (exit 0).
- pnpm run build: Biên dịch tuần tự theo đồ thị phụ thuộc monorepo (contracts -> api -> web) thành công với bản build tĩnh tối ưu của Next.js Turbopack (exit 0).
- pnpm run test: Toàn bộ 49/49 tests backend (12 unit, 18 DB constraints, 19 e2e) pass 100% trong 7.2 giây (exit 0).
- pnpm run test:smoke: Playwright tự động bật 2 server, mở Chromium và kiểm tra giao diện danh sách xe thật từ PostgreSQL thành công trong 8.3 giây (exit 0).
- pnpm run format:check: Toàn bộ file trong workspace đều tuân thủ đúng định dạng Prettier (exit 0).
Ca chưa chạy và lý do: Không có. Tất cả các suite kiểm tra của G0 đều chạy thật với bằng chứng log thực tế.
Quyết định mới/ảnh hưởng hợp đồng: Không thay đổi hợp đồng. Giữ nguyên ranh giới không import Prisma vào frontend và giữ đầy đủ bộ constraint tests của G0-07.
Commit hoặc điểm lưu diff nếu có: Sẽ commit sau khi lưu log tiến độ.
```

```text
Ngày: 27/10/2026
Task: G0-10 — Contract client và danh sách xe trên web
Trạng thái: DONE
Prerequisite: G0-04, G0-09
Files thay đổi:
- packages/contracts/package.json & tsconfig.json (Khởi tạo package @carsharing/contracts trong monorepo)
- packages/contracts/src/schema.ts (Sinh TypeScript types tự động từ OpenAPI thật bằng openapi-typescript)
- packages/contracts/src/index.ts (Xuất các type nghiệp vụ: VehicleSummary, PaginationMeta, VehicleOptions, GetVehiclesResponse)
- apps/web/package.json (Thêm dependency @carsharing/contracts workspace:*)
- apps/web/src/lib/api.ts (Client API gọi backend qua cùng origin rewrite /api/v1/vehicles và /api/v1/vehicle-options)
- apps/web/src/components/VehicleCard.tsx (Component hiển thị xe: ảnh cover, badge Keyless, hãng/model/năm, số chỗ, hộp số, tiện nghi, đơn giá ₫/ngày)
- apps/web/src/components/FilterBar.tsx (Thanh bộ lọc: chọn thành phố, loại xe, checkbox tự nhận xe Keyless, đếm kết quả, nút đặt lại)
- apps/web/src/app/page.tsx (Trang chủ: tích hợp filter, gọi API thật, phân trang, loading skeleton, empty state, error state kèm nút retry)
- apps/api/src/vehicles/vehicles.controller.ts (Bổ sung @ApiExtraModels và getSchemaPath để OpenAPI sinh đầy đủ component schemas)
- tools/export-openapi.mjs (Cập nhật đường dẫn linh hoạt hỗ trợ xuất schema trực tiếp)
- docs/PROGRESS.md (Cập nhật tiến độ hoàn thành G0-10)
Lệnh đã chạy và kết quả:
- pnpm --filter @carsharing/contracts run build: Biên dịch thành công packages/contracts/dist định nghĩa type chuẩn.
- pnpm --filter @carsharing/web run typecheck: Kiểm tra kiểu tĩnh TypeScript trên Next.js 16 đạt 0 lỗi.
- pnpm --filter @carsharing/web run build: Next.js build Turbopack sản sinh bản build tối ưu tĩnh thành công 100%.
- Kiểm tra luồng dữ liệu end-to-end:
  + Chạy NestJS API (cổng 4000) và Next.js (cổng 3000).
  + Truy vấn GET http://localhost:3000/api/v1/vehicles qua Next.js rewrite: nhận đúng 12 xe PUBLISHED từ PostgreSQL.
  + Kiểm tra an toàn: Tuyệt đối không import Prisma vào apps/web (grep search trả về 0 kết quả).
  + Kiểm tra trạng thái: UI hỗ trợ loading skeleton, empty state khi không tìm thấy xe, và error alert với nút retry khi API ngắt kết nối.
- pnpm run format:check: Toàn bộ workspace khớp quy tắc Prettier (exit 0).
Ca chưa chạy và lý do: Chưa thực hiện đặt xe hoặc tính quote chi tiết (thuộc G2 và G3).
Quyết định mới/ảnh hưởng hợp đồng: Không thay đổi hợp đồng. Định nghĩa types được chia sẻ qua package @carsharing/contracts sinh trực tiếp từ OpenAPI schema thật.
Commit hoặc điểm lưu diff nếu có: Sẽ commit sau khi lưu log tiến độ.
```

```text
Ngày: 27/10/2026
Task: G0-09 — API đọc danh sách xe và OpenAPI
Trạng thái: DONE
Prerequisite: G0-03, G0-08
Files thay đổi:
- apps/api/src/vehicles/dto/vehicle-options.dto.ts (DTO danh mục allowlist: cities, carTypes, transmissions, amenities)
- apps/api/src/vehicles/dto/query-vehicles.dto.ts (DTO lọc xe: city, startAt/endAt ISO 8601, carType, transmission, seats, minPrice/maxPrice, keylessOnly, sort, pagination)
- apps/api/src/vehicles/dto/vehicle-summary.dto.ts (DTO tóm tắt xe công khai: che giấu plateNormalized và pickupAddress, an toàn số nguyên VND)
- apps/api/src/vehicles/vehicles.service.ts (Service truy vấn DB thật: lọc PUBLISHED, loại xe quá hạn chưa trả, loại trùng lịch calendar, tính điểm đánh giá trung bình và quote)
- apps/api/src/vehicles/vehicles.controller.ts (Controller cung cấp GET /vehicle-options và GET /vehicles với OpenAPI Swagger annotations)
- apps/api/src/vehicles/vehicles.module.ts & app.module.ts (Đăng ký VehiclesModule)
- apps/api/src/main.ts (Cấu hình SwaggerModule tại /api/v1/docs và /api/v1/docs-json)
- tools/export-openapi.mjs (Script xuất OpenAPI schema ra packages/contracts/openapi.json)
- packages/contracts/openapi.json (Tài liệu OpenAPI sinh từ API thật cho các route thực tế đã triển khai)
- apps/api/src/vehicles/vehicles.controller.spec.ts & apps/api/test/vehicles.e2e-spec.ts (Bộ test unit và e2e kiểm tra toàn diện các bộ lọc, trường riêng tư, ngày sai, kết quả rỗng)
- docs/PROGRESS.md (Cập nhật tiến độ hoàn thành G0-09)
Lệnh đã chạy và kết quả:
- node tools/export-openapi.mjs: Xuất thành công file OpenAPI spec chuẩn 3.0.0 tại packages/contracts/openapi.json chỉ chứa các endpoint thực tế (/health, /vehicle-options, /vehicles).
- pnpm --filter @carsharing/api run test:all: Toàn bộ 49/49 tests (12 unit, 18 integration constraints, 19 e2e) pass 100% trong 5.4 giây.
  + GET /api/v1/vehicle-options phản hồi 200 danh mục chuẩn.
  + GET /api/v1/vehicles lọc chính xác 12 xe PUBLISHED, loại trừ hoàn toàn xe DRAFT.
  + Bảo mật: Xác nhận plateNormalized và pickupAddress không lộ trong bất kỳ kết quả tìm kiếm nào.
  + Lọc thành phố, loại xe, keylessOnly và khoảng giá hoạt động chính xác.
  + Kiểm tra lỗi: startAt thiếu endAt hoặc endAt <= startAt trả về đúng HTTP 400 VALIDATION_ERROR.
  + Kiểm tra trùng lịch: Xe có chuyến APPROVED trong khoảng ngày tìm kiếm bị loại trừ chính xác.
  + Thành phố không có xe (Huế) trả về mảng rỗng [] kèm metadata { total: 0, page: 1, pageSize: 10, totalPages: 1 }.
- pnpm run format:check: Toàn bộ workspace khớp quy tắc Prettier (exit 0).
Ca chưa chạy và lý do: Chưa tính quote đầy đủ theo module giá nâng cao (thuộc G2).
Quyết định mới/ảnh hưởng hợp đồng: Không thay đổi hợp đồng. OpenAPI được sinh tự động từ code thật thay vì viết mock giả lập.
Commit hoặc điểm lưu diff nếu có: Commit `c9c7324` ("feat(api): implement GET /vehicles and /vehicle-options with OpenAPI spec (G0-09)")
```

```text
Ngày: 27/10/2026
Task: G0-08 — Seed và lớp truy cập database
Trạng thái: DONE
Prerequisite: G0-07, G0-02
Files thay đổi:
- prisma/seed.ts (Seed dữ liệu tái lập: 4 tài khoản demo theo capability model, 13 xe gồm 12 PUBLISHED và 1 DRAFT, media verified, 4 booking ở các trạng thái, pricing snapshots, lịch bận và owner block; có chặn production)
- apps/api/src/prisma/prisma.service.ts (Service tích hợp PrismaClient với lifecycle hooks onModuleInit/onModuleDestroy)
- apps/api/src/prisma/prisma.module.ts (Module Global cung cấp PrismaService cho toàn bộ NestJS)
- apps/api/src/health/health.controller.ts & health.controller.spec.ts (Cập nhật health/readiness truy vấn DB thật bằng $queryRaw, trả 503 DATABASE_DISCONNECTED khi mất kết nối)
- apps/api/src/app.module.ts (Đăng ký PrismaModule)
- package.json & pnpm-workspace.yaml (Thêm tsx, script db:seed và allowBuilds cho esbuild)
- docs/PROGRESS.md (Cập nhật tiến độ hoàn thành G0-08)
Lệnh đã chạy và kết quả:
- pnpm exec prisma db seed: Khởi tạo thành công 4 users, 13 vehicles, 4 bookings, 4 calendar records, 4 snapshots.
- pnpm exec prisma db seed (lần 2): Xác minh tính idempotent thành công, số lượng bản ghi giữ nguyên tuyệt đối (users: 4, vehicles: 13, bookings: 4, calendar: 4, snapshots: 4).
- pnpm --filter @carsharing/api run test:all: Toàn bộ 38/38 tests unit, integration và e2e pass 100% (gồm test DB connected và DB disconnected).
- pnpm run format:check: Toàn bộ workspace khớp quy tắc Prettier (exit 0).
Ca chưa chạy và lý do: Chưa seed quyền truy cập xe của người khác (theo đúng capability model).
Quyết định mới/ảnh hưởng hợp đồng: Không thay đổi hợp đồng. Dùng fixed UUIDs cho seed để đảm bảo tính tái lập cho các suite test E2E.
Commit hoặc điểm lưu diff nếu có: Commit `a2b1673` ("feat(database): implement idempotent seed data and PrismaService with DB readiness (G0-08)")
```

```text
Ngày: 27/10/2026
Task: G0-07 — Migration và constraint PostgreSQL
Trạng thái: DONE
Prerequisite: G0-06
Files thay đổi:
- prisma/migrations/20261027050309_init_schema_and_constraints/migration.sql (Tạo migration đầy đủ 18 bảng, bổ sung btree_gist, exclusion GiST [start_at, end_at), unique partial indexes và check constraints)
- apps/api/test/constraints.integration-spec.ts (Bộ test tích hợp 18 ca kiểm tra trực tiếp trên PostgreSQL test database carsharing_test)
- apps/api/package.json (Thêm script test:constraints và cập nhật test:all)
- docs/PROGRESS.md (Cập nhật tiến độ hoàn thành G0-07)
Lệnh đã chạy và kết quả:
- pnpm exec prisma migrate deploy: Áp dụng thành công migration lên database carsharing_dev.
- DATABASE_URL=.../carsharing_test pnpm exec prisma migrate deploy: Áp dụng thành công migration lên database carsharing_test rỗng, không gây drift.
- pnpm --filter @carsharing/api run test:constraints: Toàn bộ 18/18 ca test ràng buộc chạy trên PostgreSQL thật đều PASS 100%:
  + Calendar overlap cùng xe bị từ chối với SQLSTATE 23P01 (Exclusion violation).
  + Owner block xung đột với booking bị chặn bởi exclusion constraint.
  + Touching adjacent intervals [T1, T2) và [T2, T3) được chấp nhận thành công theo ngữ nghĩa range [).
  + Overlap trên 2 xe khác nhau được chấp thuận.
  + Overlap khi bản ghi cũ đã được giải phóng (released_at IS NOT NULL) được chấp thuận.
  + Unique partial index: Chặn 2 booking IN_PROGRESS trên cùng 1 xe (SQLSTATE 23505).
  + Unique partial index: Chặn 2 keyless operation chưa giải quyết (PENDING/UNKNOWN) trên cùng 1 booking.
  + Check constraints: Giá xe <= 0 hoặc > 100M VND bị chặn; start_at >= end_at bị chặn; renter_id = owner_id bị chặn; pricing snapshot sai tổng bị chặn; review sai thang điểm 1-5 hoặc tự review bị chặn.
- pnpm --filter @carsharing/api run test:all: Toàn bộ 37/37 tests unit, integration và e2e pass (exit 0).
- pnpm run format:check: Toàn bộ workspace khớp quy tắc Prettier (exit 0).
Ca chưa chạy và lý do: Chưa kết luận API concurrency đã đạt vì booking API chưa viết (theo đúng tiêu chí G0-07).
Quyết định mới/ảnh hưởng hợp đồng: Không thay đổi hợp đồng. Bổ sung script test:constraints để kiểm tra tự động định kỳ trên database test thật.
Commit hoặc điểm lưu diff nếu có: Commit `d061e25` ("feat(database): apply initial migration with postgres constraints and add integration tests (G0-07)")
```

```text
Ngày: 27/10/2026
Task: G0-06 — Schema Prisma và quan hệ
Trạng thái: DONE
Prerequisite: G0-01, G0-05
Files thay đổi:
- prisma/schema.prisma (Định nghĩa toàn bộ 18 models và 12 enums theo DATABASE_DESIGN.md; UUID PK, @@map/@map snake_case, timestamptz(6), bigint VND, relations, onDelete phù hợp)
- package.json & apps/api/package.json (Thêm dependencies prisma@6.19.3 và @prisma/client@6.19.3)
- pnpm-workspace.yaml (Thêm allowBuilds cho prisma, @prisma/client, @prisma/engines)
- pnpm-lock.yaml (Cập nhật lockfile)
- docs/PROGRESS.md (Cập nhật tiến độ hoàn thành G0-06)
Lệnh đã chạy và kết quả:
- pnpm exec prisma format: Định dạng schema.prisma thành công trong 127ms.
- pnpm exec prisma validate: Schema hợp lệ 100% không có lỗi cú pháp hay quan hệ (exit 0).
- pnpm exec prisma generate: Sinh thành công Prisma Client v6.19.3 cho TypeScript types (exit 0).
- pnpm --filter @carsharing/api run typecheck: tsc --noEmit kiểm tra thành công với Prisma client mới (exit 0).
- pnpm --filter @carsharing/api run test: Toàn bộ 11 tests unit & smoke tests pass (exit 0).
- pnpm run format:check: Toàn bộ workspace khớp quy tắc Prettier (exit 0).
Ca chưa chạy và lý do: Chưa chạy migration trên database (đây là nhiệm vụ của task G0-07 tiếp theo).
Quyết định mới/ảnh hưởng hợp đồng: Không thay đổi hợp đồng. Không tạo FK vòng giữa booking và pricing_snapshot (pricing_snapshot có unique FK booking_id theo đúng kiến trúc).
Commit hoặc điểm lưu diff nếu có: Commit `a1d96b8` ("feat(database): define Prisma schema for 18 models and relations (G0-06)")
```

```text
Ngày: 27/10/2026
Task: G0-05 — PostgreSQL và object storage local
Trạng thái: DONE
Prerequisite: G0-00, G0-01
Files thay đổi:
- infra/compose.yaml (Định nghĩa services: postgres:18-alpine, minio: pgsty/silo:latest, minio-init: pgsty/mc:latest; persistent named volumes; healthchecks)
- infra/init-db.sh (Script khởi tạo cài đặt btree_gist trên cả carsharing_dev và carsharing_test)
- README.md (Bổ sung mục Hướng dẫn Khởi chạy Môi trường Hạ tầng Local, lệnh start/stop bảo toàn volume)
- docs/PROGRESS.md (Cập nhật tiến độ hoàn thành G0-05)
Lệnh đã chạy và kết quả:
- docker compose -f infra/compose.yaml up -d: Khởi chạy carsharing-postgres, carsharing-minio và carsharing-minio-init thành công.
- docker compose -f infra/compose.yaml ps -a: Cả 2 service postgres và minio đều đạt trạng thái "healthy" (postgres port 5433->5432, minio port 9000-9001).
- carsharing-minio-init hoàn tất với Exit 0: Khởi tạo bucket 'car-sharing-private' và thiết lập quyền 'private' (anonymous: none).
- docker exec carsharing-postgres psql -U carsharing -d carsharing_dev -c "SELECT extname, extversion FROM pg_extension;": Xác nhận btree_gist v1.8 đã cài đặt thành công trên carsharing_dev.
- docker exec carsharing-postgres psql -U carsharing -d carsharing_test -c "SELECT extname, extversion FROM pg_extension;": Xác nhận btree_gist v1.8 đã cài đặt thành công trên carsharing_test.
- curl -i http://localhost:9000/car-sharing-private/test-probe.txt: Phản hồi HTTP 403 Forbidden <Code>AccessDenied</Code> xác nhận anonymous bị chặn hoàn toàn.
- docker run --rm --entrypoint /bin/sh --network infra_default pgsty/mc:latest -c "...": Upload file thử nghiệm 'probe.txt' bằng credential local và download lại kiểm tra nội dung 'Car Sharing Platform S3 Probe Test' khớp 100%.
- Kiểm tra bảo toàn volume: Dữ liệu được lưu trữ an toàn trong named volumes carsharing_postgres_data và carsharing_minio_data.
Ca chưa chạy và lý do: Chưa tích hợp Google hoặc S3 production (theo đúng tiêu chí G0-05).
Quyết định mới/ảnh hưởng hợp đồng: Không thay đổi hợp đồng. Docker PostgreSQL ánh xạ cổng host 5433:5432 để hoạt động song song với native PostgreSQL 18 trên cổng 5432.
Commit hoặc điểm lưu diff nếu có: Commit `53a76e9` ("feat(infra): configure postgresql 18 and minio with private bucket (G0-05)")
```

```text
Ngày: 27/10/2026
Task: G0-04 — Khởi tạo Next.js và kết nối cùng origin
Trạng thái: DONE
Prerequisite: G0-01, G0-02
Files thay đổi:
- apps/web/package.json (scaffold @carsharing/web, ghim Next.js 16.4.3, React 19.3.1, Tailwind CSS v4, scripts dev/build/start/typecheck)
- apps/web/tsconfig.json (kế thừa tsconfig.base.json, paths @/*, strict)
- apps/web/next.config.ts (cấu hình rewrite cùng origin /api/v1/:path* tới backend qua biến server API_INTERNAL_URL)
- apps/web/postcss.config.mjs (cấu hình @tailwindcss/postcss)
- apps/web/src/app/globals.css (Tailwind v4 imports và style nền tảng)
- apps/web/src/app/layout.tsx (shell tiếng Việt lang="vi", responsive metadata)
- apps/web/src/app/page.tsx (trang chủ tiếng Việt, trạng thái kết nối loading/connected/error, uptime, timestamp thực tế)
- pnpm-lock.yaml (cập nhật lockfile)
- docs/PROGRESS.md (cập nhật tiến độ)
Lệnh đã chạy và kết quả:
- pnpm install: Cài đặt thành công Next.js 16.4.3, React 19.3.1, Tailwind 4.3.3
- pnpm --filter @carsharing/web run typecheck: tsc --noEmit thành công (exit 0)
- pnpm --filter @carsharing/web run build: next build thành công với Turbopack (exit 0)
- next start & node apps/api/dist/main: Khởi động song song hai app, gọi Invoke-RestMethod http://localhost:3000/api/v1/health (cùng origin cổng 3000) phản hồi HTTP 200 { data: { status: 'ok', timestamp: '...', uptime: 48 } }
- Gọi http://localhost:3000 trả về HTML tiếng Việt hoàn chỉnh
- pnpm run format:check: Toàn bộ workspace khớp quy tắc định dạng Prettier (exit 0)
Ca chưa chạy và lý do: Chưa giả lập danh sách xe và chưa hardcode số liệu dashboard (theo đúng yêu cầu G0-04).
Quyết định mới/ảnh hưởng hợp đồng: Không đổi hợp đồng. Địa chỉ nội bộ backend (http://localhost:4000) được giữ bí mật phía server Next.js qua API_INTERNAL_URL.
Commit hoặc điểm lưu diff nếu có: Commit `6e5ef8c` ("feat(web): scaffold Next.js App Router with same-origin health rewrite (G0-04)")
Task đề xuất tiếp theo: G0-05 — PostgreSQL và object storage local
```

```text
Ngày: 27/10/2026
Task: G0-03 — Nền xử lý request và lỗi API
Trạng thái: DONE
Prerequisite: G0-02
Files thay đổi:
- apps/api/src/common/middleware/request-id.middleware.ts (sinh/validate requestId an toàn, gắn header X-Request-Id)
- apps/api/src/common/interceptors/transform.interceptor.ts (chuẩn hóa envelope { data, meta? }, chống double wrap, bỏ qua 204/redirect)
- apps/api/src/common/filters/http-exception.filter.ts (chuẩn hóa lỗi { error: { code, message, details? }, requestId }, phân biệt 400 validation, 404, 409, 422; ẩn stack trace và dữ liệu nhạy cảm ở 500)
- apps/api/src/common/index.ts (barrel export cho common)
- apps/api/src/app.module.ts (đăng ký RequestIdMiddleware cho mọi route)
- apps/api/src/main.ts (đăng ký ValidationPipe, TransformInterceptor, HttpExceptionFilter toàn cục)
- apps/api/package.json (bổ sung scripts test, test:e2e, test:all)
- apps/api/src/common/middleware/request-id.middleware.spec.ts (unit test 3 ca: UUID generation, header preserve, sanitization)
- apps/api/src/common/interceptors/transform.interceptor.spec.ts (unit test 3 ca: wrapping, prevent double-wrap, 204 skip)
- apps/api/src/common/filters/http-exception.filter.spec.ts (unit test 3 ca: format HttpException, validation details, 500 secret masking)
- apps/api/test/request-error.e2e-spec.ts (e2e test 7 ca: success envelope, requestId echo, 404 unknown, 400 validation, 409 conflict, 500 crash masking, 204 no-content)
- docs/PROGRESS.md (cập nhật tiến độ)
Lệnh đã chạy và kết quả:
- pnpm --filter @carsharing/api run build: nest build thành công (exit 0)
- pnpm --filter @carsharing/api run typecheck: tsc --noEmit thành công (exit 0)
- pnpm --filter @carsharing/api run test:all: 19 ca test (unit & e2e) chạy qua node test runner đều PASS 100% (exit 0)
- pnpm run format:check: Toàn bộ workspace khớp quy tắc định dạng Prettier (exit 0)
Ca chưa chạy và lý do: Chưa tạo auth giả để đi tiếp các module bảo vệ (theo đúng yêu cầu G0-03).
Quyết định mới/ảnh hưởng hợp đồng: Không đổi hợp đồng. Cấu trúc response tuân thủ tuyệt đối API_CONTRACT.md: thành công { data, meta? }, lỗi { error: { code, message, details? }, requestId }.
Commit hoặc điểm lưu diff nếu có: Commit `d02e069` ("feat(api): implement request-id, response envelope, and exception filter (G0-03)")
Task đề xuất tiếp theo: G0-04 — Khởi tạo Next.js và kết nối cùng origin
```

```text
Ngày: 27/10/2026
Task: G0-02 — Khởi tạo NestJS và health check
Trạng thái: DONE
Prerequisite: G0-01
Files thay đổi:
- apps/api/package.json (scaffold @carsharing/api, ghim NestJS 12.2.0, class-validator, class-transformer, scripts test/e2e)
- apps/api/tsconfig.json & apps/api/tsconfig.build.json (kế thừa tsconfig.base.json, commonjs, moduleResolution node, strict)
- apps/api/nest-cli.json (cấu hình Nest CLI)
- apps/api/src/config/env.validation.ts (validation cấu hình NODE_ENV, API_PORT, CORS_ORIGIN bằng class-validator)
- apps/api/src/health/health.controller.ts & apps/api/src/health/health.module.ts (GET /health trả status ok, timestamp UTC ISO, uptime; không lộ secret)
- apps/api/src/app.module.ts (ConfigModule toàn cục + HealthModule)
- apps/api/src/main.ts (tiền tố toàn cục /api/v1, graceful shutdown, cấu hình CORS, khởi chạy cổng 4000)
- apps/api/src/health/health.controller.spec.ts (unit test 2 ca: defined & data response structure)
- apps/api/test/health.e2e-spec.ts (smoke e2e test gọi GET /api/v1/health qua supertest, nhận 200 OK)
- pnpm-workspace.yaml & pnpm-lock.yaml (cập nhật allowBuilds và lockfile)
- docs/PROGRESS.md (cập nhật tiến độ)
Lệnh đã chạy và kết quả:
- pnpm --filter @carsharing/api run build: nest build thành công (exit 0)
- pnpm --filter @carsharing/api run typecheck: tsc --noEmit thành công (exit 0)
- pnpm --filter @carsharing/api run test: 2 unit tests pass (exit 0)
- pnpm --filter @carsharing/api run test:e2e: 1 smoke e2e test pass (exit 0)
- node dist/main.js & Invoke-RestMethod: Máy chủ khởi động lắng nghe port 4000, gọi GET http://localhost:4000/api/v1/health trả đúng { data: { status: 'ok', timestamp: '...', uptime: ... } } (HTTP 200)
- pnpm run format:check: Toàn bộ workspace khớp quy tắc định dạng Prettier (exit 0)
Ca chưa chạy và lý do: Chưa tích hợp Prisma readiness DB (chờ G0-05/G0-06), chưa có business modules (theo kế hoạch G0-03 trở đi).
Quyết định mới/ảnh hưởng hợp đồng: Không thay đổi hợp đồng. Tiền tố API là /api/v1, response chuẩn { data }. Cấu hình allowBuilds cho pnpm v12 trong pnpm-workspace.yaml.
Commit hoặc điểm lưu diff nếu có: Commit `176fe49` ("feat(api): scaffold NestJS API with health check (G0-02)")
Task đề xuất tiếp theo: G0-03 — Nền xử lý request và lỗi API
```

```text
Ngày: 27/10/2026
Task: G0-01 — Khởi tạo workspace và baseline
Trạng thái: DONE
Prerequisite: G0-00
Files thay đổi:
- package.json (root configuration, scripts format/format:check, devDependencies: prettier, typescript, @types/node)
- pnpm-workspace.yaml (apps/*, packages/*)
- pnpm-lock.yaml (lockfile tái lập)
- tsconfig.base.json (strict TypeScript: ES2022, NodeNext, noImplicitAny, strictNullChecks, noUncheckedIndexedAccess,...)
- .env.example (nhóm biến môi trường: Server, PostgreSQL, S3/MinIO, JWT/Cookie, Google OIDC, Keyless Simulator)
- .gitignore (cập nhật monorepo, node_modules, .pnpm-store, builds, env, logs)
- .prettierrc & .prettierignore (cấu hình format mã nguồn, bảo vệ lockfile và tài liệu docs)
- apps/.gitkeep & packages/.gitkeep (cấu trúc thư mục)
- docs/PROGRESS.md (cập nhật tiến độ)
Lệnh đã chạy và kết quả:
- npm install -g pnpm@12.15.0: Đã cài pnpm v12.15.0 vào AppData\Roaming\npm
- git init: Khởi tạo Git repository local baseline
- pnpm install: Cài đặt thành công 4 packages (prettier@3.9.10, typescript@5.8.3, @types/node@24.19.2), sinh pnpm-lock.yaml
- pnpm run format: Định dạng kiểm tra qua Prettier thành công (exit 0)
- pnpm run format:check: Xác nhận toàn bộ file tuân thủ format (exit 0)
Ca chưa chạy và lý do: Chưa scaffold apps/api và apps/web (thuộc G0-02 và G0-04)
Quyết định mới/ảnh hưởng hợp đồng: Không đổi hợp đồng. Định nghĩa chuẩn biến môi trường trong .env.example theo các ADR đã chốt.
Commit hoặc điểm lưu diff nếu có: Commit `90c2151` ("chore: initialize workspace baseline (G0-01)")
Task đề xuất tiếp theo: G0-02 — Khởi tạo NestJS và health check
```

```text
Ngày: 27/10/2026
Task: G0-00 — Kiểm tra môi trường và chọn phiên bản
Trạng thái: DONE
Prerequisite: Không có
Files thay đổi: docs/TECH_STACK.md (tạo mới), docs/PROGRESS.md (cập nhật)
Lệnh đã chạy và kết quả:
- Hệ điều hành & Shell: Windows 10 Pro 64-bit (10.0.19045), PowerShell 5.1.19041.6456 (Đạt)
- Git: git version 2.56.0.windows.1 (Đạt, chưa init .git)
- Node.js: v24.21.0 (Đạt, Maintenance LTS, đáp ứng NestJS 12 CLI)
- Package Managers: npm 11.19.0, corepack 0.36.0 (pnpm chưa có trong PATH, sẽ kích hoạt ở G0-01)
- Docker: Docker 29.8.0, Docker Compose v5.5.1 (Docker Desktop chưa khởi động, WSL docker-desktop Stopped)
- PostgreSQL host: Service postgresql-x64-18 (v18.6) đang chạy tại PID 5544, chiếm port 5432. Extension btree_gist đã có sẵn tại C:\Program Files\PostgreSQL\18\share\extension
- Kiểm tra cổng: 3000, 3001, 4000, 5433, 9000, 9001 trống; 5432 đang bận
- npm view registry: Pin chính thức pnpm@12.15.0, @nestjs/core@12.2.0, @nestjs/cli@12.0.10, next@16.4.3, react@19.3.1, prisma@6.19.3
Ca chưa chạy và lý do: Chưa scaffold source code, chưa chạy migration/seed (thuộc G0-01 đến G0-12)
Quyết định mới/ảnh hưởng hợp đồng: Không thay đổi hợp đồng. Ghim Prisma 6.19.3 theo DECISIONS.md (ADR-09). Đề xuất ánh xạ cổng Docker Compose ở 5433:5432 để tránh xung đột cổng 5432 với PostgreSQL native. Dùng MinIO từ quay.io do Docker Hub đã gỡ bỏ repo community.
Commit hoặc điểm lưu diff nếu có: Chưa có Git repo (sẽ khởi tạo ở G0-01)
Task đề xuất tiếp theo: G0-01 — Khởi tạo workspace và baseline
```

