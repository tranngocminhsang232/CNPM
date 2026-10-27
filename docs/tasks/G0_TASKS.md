# Task triển khai giai đoạn G0

Trạng thái khởi tạo: tất cả task dưới đây CHƯA LÀM. Đây là các task triển khai mới, không phải các bước sửa tài liệu đã hoàn tất. Chỉ làm một task tại một thời điểm theo chỉ dẫn người dùng.

Tên file là vị trí dự kiến theo cấu trúc đã chốt. G0-00/G0-01 xác nhận tên và cơ chế package cụ thể theo bộ phiên bản; các task sau đọc file có thật thay vì tạo cấu hình trùng. Một task có thể cần nhiều file gắn với cùng kết quả kiểm chứng.

## G0-00 Kiểm tra môi trường và chọn phiên bản

Phụ thuộc: không có. File chính: docs/TECH_STACK.md. File cập nhật: docs/PROGRESS.md.

Kiểm tra Windows/shell, Git nếu có, Node, package manager, Docker/Compose, cổng local và khả năng chạy PostgreSQL/object storage. Không cài hoặc thay môi trường hệ thống một cách âm thầm. Chọn Node LTS, pnpm, Next.js/React, NestJS, Prisma, PostgreSQL và S3-compatible image tương thích qua tài liệu chính thức; ghi version cụ thể, runtime requirements và nguồn xác minh. Không cần tải tất cả dependency ở task này.

Đạt khi có ma trận phiên bản/công cụ, công cụ thiếu được ghi rõ và lựa chọn storage/DB local khả thi. Chưa viết source ứng dụng, chưa tạo kết quả build/test giả. Công cụ không sẵn có không đồng nghĩa đã cài thành công.

## G0-01 Khởi tạo workspace và baseline

Phụ thuộc: G0-00. File chính: package.json, pnpm-workspace.yaml, tsconfig.base.json. File liên quan: .gitignore, .env.example, lockfile và cấu hình lint/format cần thiết.

Tạo workspace apps/* và packages/*, pin Node/package manager, strict TypeScript và định dạng chung. Chuẩn bị Git repository nếu chưa có, giữ nguyên tài liệu và backup. Bổ sung .env.example theo nhóm cấu hình, không chứa secret thật. Chỉ tạo script gọi công cụ đã có; không tạo build/test stub thành công. App con được thêm ở task sau.

Đạt khi dependency cài tái lập theo lockfile, cấu hình workspace/format được kiểm tra thực tế, thay đổi xem được qua diff/baseline. Chưa yêu cầu root build hai app chưa được tạo.

## G0-02 Khởi tạo NestJS và health check

Phụ thuộc: G0-01. Vùng file: apps/api/package.json, tsconfig và src/main.ts, src/app.module.ts, health controller/test.

Scaffold NestJS tối thiểu; prefix /api/v1, config validation cho biến bắt buộc hiện dùng và graceful shutdown. GET /api/v1/health trả liveness tối thiểu, không tiết lộ secret. Chỉ inject các dependency đã được tạo; readiness DB bổ sung sau khi có Prisma.

Đạt khi API khởi động, build/typecheck và smoke test health chạy thật. Không tạo sẵn toàn bộ business modules với TODO hoặc endpoint giả. File sinh bởi scaffold phải được nêu riêng trong báo cáo.

## G0-03 Nền xử lý request và lỗi API

Phụ thuộc: G0-02. Vùng file: apps/api/src/common cho requestId, exception filter, response interceptor/validation và test tương ứng.

Chuẩn hóa {data,meta?} và {error,requestId} theo API_CONTRACT. Phân biệt validation 400 và lỗi nghiệp vụ 422/409; giữ mã HTTP phù hợp. Không double-wrap response, không bọc 204/redirect thành JSON. Xử lý requestId có giới hạn và lọc log nhạy cảm.

Đạt khi test kiểm tra success, malformed input, unknown route, lỗi không mong đợi và requestId; không lộ stack/secret. Chưa tạo auth giả để đi tiếp các module bảo vệ.

## G0-04 Khởi tạo Next.js và kết nối cùng origin

Phụ thuộc: G0-01, G0-02. Vùng file: apps/web/package.json, cấu hình Next.js/TypeScript, app/layout.tsx, app/page.tsx và global styles.

Scaffold Next.js App Router/TypeScript/Tailwind theo phiên bản đã chọn. Tạo shell tiếng Việt và kết nối /api/v1 tới NestJS qua rewrite hoặc proxy phù hợp. Địa chỉ nội bộ backend là cấu hình server, không phải secret cần public ra client. Trang đầu hiển thị trạng thái kết nối health thật; chưa giả lập danh sách xe.

Đạt khi web build/typecheck và gọi health cùng origin thực tế; trạng thái mất kết nối hiển thị rõ. Không tự dựng dashboard với số liệu hardcode được gọi là dữ liệu thật.

## G0-05 PostgreSQL và object storage local

Phụ thuộc: G0-00, G0-01. File chính: infra/compose.yaml. File liên quan: .env.example và README phần chạy local.

Tạo PostgreSQL và MinIO/S3-compatible theo image version đã pin, volumes riêng và health checks. Tách cấu hình test DB khỏi DB phát triển. Cấu hình bucket private và CORS local cho upload; không public toàn bucket để né quyền. Xác minh btree_gist có thể được cài qua migration. Không mount hoặc xóa dữ liệu ngoài phạm vi project.

Đạt khi các service healthy, kết nối DB và upload/download object thử bằng credential local thành công, bucket không cho anonymous đọc tùy ý. Ghi rõ cách start/stop không xóa volume. Chưa yêu cầu Google hoặc S3 production.

## G0-06 Schema Prisma và quan hệ

Phụ thuộc: G0-01, G0-05. File chính: prisma/schema.prisma; cấu hình Prisma/client theo version và dependency lockfile liên quan.

Chuyển DATABASE_DESIGN.md thành model/enum với @@map/@map, UUID, timestamptz, bigint VND, FK, unique và index. Bao phủ calendar, snapshot, idempotency, operation/manual, review và media; không chỉ ba bảng users/vehicles/bookings. Các constraint không biểu diễn được bằng Prisma được liệt kê để G0-07 thêm raw SQL.

Đạt khi format/validate schema và generate client chạy thật. Không gọi schema generate là migration đã chạy. Không tạo FK vòng giữa booking và snapshot; API snapshotId lấy từ relation unique.

## G0-07 Migration và constraint PostgreSQL

Phụ thuộc: G0-06. Vùng file: prisma/migrations, lock/config cần thiết và integration test constraint.

Tạo migration từ schema; thêm btree_gist, exclusion calendar [start,end), check constraints, unique một IN_PROGRESS/vehicle và một unresolved operation/booking theo thiết kế. Chạy trên DB thử rỗng; xác minh việc migrate lại không gây drift. Test insert trực tiếp để chứng minh constraint tồn tại, dùng dữ liệu có quan hệ hợp lệ và cleanup trong DB thử.

Đạt khi migration chạy và các ca overlap bị từ chối, touching được phép, owner block xung đột booking bị chặn. Không mock Prisma/PostgreSQL trong các ca này. Chưa kết luận API concurrency đã đạt vì booking API chưa viết.

## G0-08 Seed và lớp truy cập database

Phụ thuộc: G0-07, G0-02. File chính: prisma/seed.ts và Prisma provider/module trong apps/api; cấu hình script/README liên quan.

Seed tái lập cho 4 tài khoản demo có hai mục đích owner/renter, 12 xe PUBLISHED và 1 DRAFT, private media fixture và lịch bận/booking đại diện. Theo mô hình khả năng, tài khoản có thể dùng cả hai giao diện; không seed quyền truy cập xe của người khác. Dùng test clock hoặc thời gian tương đối rõ ràng; dữ liệu test không phụ thuộc credential thật. Seed không được chạy lên production một cách mặc định.

Đạt khi chạy lại seed không nhân bản dữ liệu, API truy vấn DB thật được, readiness phản ánh DB mất kết nối. Demo credentials chỉ cho local/test, hướng dẫn quản lý bằng env; không ghi token thật vào log.

## G0-09 API đọc danh sách xe và OpenAPI

Phụ thuộc: G0-03, G0-08. Vùng file: module/controller/service/DTO đọc xe, OpenAPI config và test liên quan.

Triển khai GET /vehicles và /vehicle-options theo hợp đồng. Dùng dữ liệu thật, filter có validate, sort ổn định, phân trang và quy tắc calendar trong DB. Loại DRAFT, hold còn hạn, owner block và xe quá giờ chưa trả theo SRS. coverImageUrl phải phản ánh media hợp lệ; không lộ plate/địa chỉ chính xác/giấy tờ. Có thể chưa có quote vì trường quote là tùy chọn; chức năng tính giá đầy đủ thuộc G2.

Đạt khi các bộ lọc được khai báo của route đều hoạt động và có ca dữ liệu rỗng, ngày sai, touching, hold hết hạn, private fields. Route nào chưa làm không được trình bày như đã làm. Sinh OpenAPI cho các endpoint đã thực sự triển khai, không dùng tài liệu Swagger để giả rằng toàn bộ API đã sẵn sàng.

Nếu phạm vi controller/service/DTO/test vượt khả năng review trong một lượt, tách thành G0-09a DTO/contract, G0-09b query, G0-09c controller/integration; ghi trạng thái riêng và chỉ DONE task cha khi cả ba đạt.

## G0-10 Contract client và danh sách xe trên web

Phụ thuộc: G0-04, G0-09. Vùng file: packages/contracts, API client web, trang danh sách và states/components tối thiểu.

Sinh DTO/type hoặc typed client từ OpenAPI của API thật. Chọn cơ chế phù hợp phiên bản, có lệnh tái sinh, tránh copy type riêng vào frontend. UI dùng city/ngày hợp lệ và gọi GET /vehicles thật qua cùng origin; hiển thị card xe, giá/ngày, phân trang và trạng thái loading/empty/error. Không import Prisma vào web.

Đạt khi dữ liệu seed đi từ PostgreSQL → NestJS → Next.js; đổi dữ liệu DB được phản ánh trên UI; API tắt thì UI báo lỗi. Chưa tuyên bố đặt xe hoặc tính quote đã hoàn tất.

## G0-11 Kiểm tra xuyên suốt và CI baseline

Phụ thuộc: G0-07, G0-10. Vùng file: API integration tests, Playwright smoke, config CI, scripts workspace và README.

Thiết lập các lệnh lint/typecheck/build/test có thực thi thật cho phần đang có; CI dùng PostgreSQL/object storage thử khi cần. Một smoke test trình duyệt xác nhận danh sách xe từ API; API test kiểm tra calendar/data exposure; giữ constraint tests từ G0-07. Không đặt placeholder suite thành công cho các tính năng G1–G5 chưa viết.

Đạt khi có log thực tế của install theo lockfile, migrate/seed test, lint, typecheck, build và các suite G0. Nếu môi trường không chạy được browser/DB, ghi phần chưa chạy và giữ task chưa DONE tới khi có bằng chứng bắt buộc.

## G0-12 Review trước khi chuyển G1

Phụ thuộc: G0-11. File chính: docs/PROGRESS.md, docs/TECH_STACK.md và README; sửa lỗi có căn cứ trong phạm vi G0 nếu phát hiện.

Đối chiếu file thực tế, scripts, OpenAPI, DB constraints và luồng đọc xe với task cards. Kiểm tra fresh setup bằng hướng dẫn hiện có, quyền media, dữ liệu fixture, secret/log và Git diff. Lập task cards G1 dựa trên đường dẫn/type/module đã có, gồm auth/cookie/CSRF, Google OIDC, quyền xe và upload.

Đạt khi các task G0 đã có bằng chứng, không còn module giả dùng để che phần thiếu và người đọc có thể chạy baseline. Chỉ chuẩn bị task G1; không tự viết auth sau khi hoàn thành G0-12 nếu chưa được giao.

## Mẫu task cho G1 trở đi

```text
ID và tên:
Yêu cầu SRS/API liên quan:
Prerequisite đã DONE:
File cần đọc:
File chính dự kiến:
File liên quan bắt buộc:
Kết quả cần có:
Không mở rộng sang:
Ca kiểm tra và expected:
Lệnh kiểm tra thực tế sau khi xem package.json:
Điều kiện DONE:
Kết quả/giới hạn cần ghi vào PROGRESS.md:
```

Thứ tự tiếp theo vẫn là G1 auth/xe/media → G2 search/pricing hoàn chỉnh → G3 booking → G4 checklist/Keyless → G5 review/dashboard/nghiệm thu. Không cần viết trước đường dẫn mọi file của G1–G5 khi scaffold G0 chưa tồn tại.
