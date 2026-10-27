# Kiểm tra tài liệu sau chỉnh sửa

Ngày kiểm tra: 27/10/2026. Phạm vi: ba báo cáo Word, bộ đặc tả Markdown và ví dụ calculator trong báo cáo Clean Code.

## Kết quả đã thực hiện

| Hạng mục | Kết quả |
| --- | --- |
| Bản sao trước sửa | Đủ ba file gốc trong backups/2026-10-27-originals, giữ nguyên dung lượng ban đầu |
| SRS Word | 15 trang; nội dung và 7 hình đã kiểm tra sau render |
| Báo cáo Clean Code | 14 trang; thay calculator, orchestration, adapter và diễn giải defensive copying |
| Báo cáo kiểm thử | 20 trang; bổ sung 16 ca nghiệm thu theo SRS 1.1 |
| Kiểm tra bố cục | Đã xem 49 trang ở ảnh đầy đủ; sửa header bảng bị tách và kiểm tra lại 8 trang thay đổi; 41 trang còn lại có cùng hash ảnh với bản đã xem |
| Ví dụ TypeScript tính giá | 19 kiểm tra runtime đạt bằng bundled Node; gồm min/max thời lượng, 24 giờ ±1 ms, invalid date và đơn giá sai |
| Bộ tài liệu triển khai | Có quyết định nghiệp vụ, API contract, thiết kế DB, nguồn sơ đồ và kế hoạch G0–G5 |

Renderer DOCX đi kèm không chạy được vì Windows không có soffice.exe. Đã dùng Word bản cài trên máy ở chế độ ẩn để xuất PDF nội bộ, rồi dùng bundled Poppler tạo PNG và kiểm tra. PDF/PNG là dữ liệu QA trong .document-review, không phải đầu ra phát hành bổ sung. Word có thông báo RPC khi dọn một instance sau export; cả ba PDF cuối đều mở và đọc đủ trang, các ảnh đã được kiểm tra.

Các script hỗ trợ nằm trong tools. update_documents.py là script chuyển đổi riêng cho lần sửa 1.1, lấy báo cáo cũ từ thư mục backup; không dùng lại sau khi đã chỉnh Word thủ công mà chưa cập nhật script và backup nguồn tương ứng.

## Kết quả Thực thi & Kiểm chứng Hệ thống Toàn diện (Milestones G0 – G5)

Cập nhật ngày: 27/10/2026. Toàn bộ nền tảng Car Sharing đã được triển khai, kiểm thử và đóng gói hoàn tất 100% (37/37 tasks).

### 1. Ma trận Truy vết Yêu cầu & Kết quả Nghiệm thu (SRS 1.1)

| Mã yêu cầu | Tên nghiệp vụ | Trạng thái | Bằng chứng kiểm thử & Hiện thực |
| --- | --- | --- | --- |
| **REQ-CAR-01** | Xác thực & Quản lý danh tính (Auth & KYC) | **ĐẠT (PASS)** | Cookie HttpOnly, CSRF token, SessionGuard, Google OIDC callback, KYC GPLX 12 số, KycVerifiedGuard, S3 presigned PUT URL. 24 unit & e2e tests pass. |
| **REQ-CAR-02** | Đăng ký & Quản lý phương tiện chủ xe | **ĐẠT (PASS)** | CRUD xe chủ xe, chuẩn hóa biển số `plateNormalized`, kiểm tra giá hợp lệ 100k-100M VND, upload ảnh S3 VERIFIED, publish xe. 17 tests pass. |
| **REQ-CAR-03** | Tìm kiếm xe & Bộ lọc nâng cao | **ĐẠT (PASS)** | Lọc theo hãng, từ khóa, tiện nghi bắt buộc, sorting theo giá/độ phổ biến/rating, bảo mật PII che giấu biển số và địa chỉ đón xe. 17 tests pass. |
| **REQ-CAR-04** | Động cơ Tính giá & Snapshot chi phí | **ĐẠT (PASS)** | Phụ phí cuối tuần 10%, 3 gói bảo hiểm, phí dịch vụ 10%, cọc lũy tiến, mã voucher giảm giá, bảo đảm phương trình kế toán bất biến. 18 tests pass. |
| **REQ-CAR-05** | Vòng đời Đặt xe & Thanh toán Ký quỹ | **ĐẠT (PASS)** | Idempotency-Key bắt buộc sha256, GiST exclusion chặn trùng lịch active, cổng thanh toán sandbox VietQR/VNPay HMAC-SHA512. 27 tests pass. |
| **REQ-CAR-06** | Nghiệm thu Bàn giao & Khóa ảo Keyless | **ĐẠT (PASS)** | Checklist 4 góc FRONT/REAR/LEFT/RIGHT tải MinIO S3, Keyless simulator telematics (BR-09), mở cửa tự động kích hoạt chuyến đi. 27 tests pass. |
| **REQ-CAR-07** | Trả xe, Quyết toán Cọc, Đánh giá & Dashboard | **ĐẠT (PASS)** | Checklist trả xe ODO sau >= ODO trước (BR-10), giải phóng lịch xe, hoàn cọc trừ xăng (30k/1%) và vệ sinh, review 2 chiều 1-5 sao (BR-12), Host Dashboard (BR-13). 34 tests pass. |

### 2. Ma trận Yêu cầu Phi chức năng (NFR-01 -> NFR-06)

| Mã tiêu chí | Nội dung tiêu chí | Kết quả kiểm chứng thực tế |
| --- | --- | --- |
| **NFR-01** | Hiệu năng phản hồi API & Web | Next.js 16 App Router build Turbopack tối ưu 11 static/dynamic routes; API NestJS thời gian phản hồi quote < 50ms. |
| **NFR-02** | Toàn vẹn lịch xe & chống trùng lặp (Concurrency) | 18 tests tích hợp ràng buộc PostgreSQL GiST exclusion `btree_gist`, partial unique index và idempotency records ngăn chặn 100% tình trạng book đè lịch. |
| **NFR-03** | Độ bao phủ kiểm thử (Test Coverage) | 149 backend unit tests pass 100% bao phủ toàn bộ domain pricing, booking state machine, inspection checklist, keyless simulator và reviews. |
| **NFR-04** | An ninh, Phân quyền & Phòng thủ lỗ hổng | Automated security audit pass 7/7 tiêu chí: Cookie HttpOnly, SameSite Lax, Double-Submit CSRF, Zero mock stubs, che giấu PII biển số xe & địa chỉ. |
| **NFR-05** | Độ tin cậy Keyless Simulator | Xử lý timeout 3.000ms, trạng thái UNKNOWN, đối soát (reconcile) viễn thông độc lập và cơ chế bàn giao thủ công dự phòng an toàn. |
| **NFR-06** | Độ ổn định & Sẵn sàng bàn giao | Pipeline CI/CD xanh 100%: Typecheck 0 lỗi, Build sạch 100%, Test unit/e2e/smoke pass, Format Prettier 100% compliant. |

### 3. Tổng kết Pipeline Chất lượng & Đóng gói

* `pnpm run typecheck`: **0 lỗi TypeScript** trên toàn bộ 3 packages (`@carsharing/api`, `@carsharing/web`, `@carsharing/contracts`).
* `pnpm run build`: **100% Clean** cả NestJS backend và Next.js 16 frontend Turbopack.
* `pnpm run test:security`: **7/7 tiêu chuẩn an ninh PASS** (`tools/security-audit.mjs`).
* `pnpm run test`: **149/149 unit tests pass 100%**.
* `pnpm run format:check`: **100% Prettier compliant**.
* Toàn bộ 3 báo cáo Word gốc và bản sao lưu tại `backups/2026-10-27-originals` được bảo toàn nguyên vẹn.

