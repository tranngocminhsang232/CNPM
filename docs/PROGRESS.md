# Tiến độ triển khai Car Sharing

Baseline bàn giao ngày 27/10/2026. Cập nhật sau từng task; ghi lệnh/kết quả thực tế, không chỉ đánh dấu checklist.

## Đã có trước khi code

- SRS 1.1, quyết định nghiệp vụ, API contract, thiết kế dữ liệu và kế hoạch G0–G5.
- Ba báo cáo Word đã chỉnh sửa và bản gốc được sao lưu.
- Handoff cho Gemini và task cards G0.
- Kiểm tra tài liệu/ví dụ calculator ghi ở VERIFICATION.md; chưa có test ứng dụng.

## Task hiện tại

Task đề xuất tiếp theo: **G0-11** (Kiểm tra xuyên suốt và CI baseline). Task G0-10 đã hoàn tất và được ghi nhận.

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
| G0-11 | CI và kiểm tra G0 | TODO | Chưa chạy app build/test |
| G0-12 | Review và chuẩn bị G1 | TODO | Phụ thuộc G0 hoàn tất |

TODO: chưa bắt đầu. IN_PROGRESS: đang thực hiện. BLOCKED: thiếu điều kiện cụ thể, ghi rõ. DONE: toàn bộ điều kiện bắt buộc đạt và có bằng chứng. Không đổi DONE chỉ vì đã viết xong file.

## Nhật ký mỗi task

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

