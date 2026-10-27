# Đặc tả yêu cầu hệ thống Car Sharing

Phiên bản 1.1 ngày 27/10/2026. Nhóm 7. Học phần Công nghệ Phần mềm. Giảng viên hướng dẫn Th.S Võ Thị Kim Anh.

Hệ thống kết nối chủ xe và người thuê, hỗ trợ đăng xe, tìm kiếm, báo giá, đặt xe, checklist nhận và trả xe, truy cập Keyless, đánh giá hai chiều và dashboard chủ xe. Bản MVP triển khai đủ luồng nghiệp vụ với Keyless simulator. Các quy tắc dưới đây là cơ sở chung để thiết kế API, dữ liệu và nghiệm thu.

## 1 Phạm vi và trách nhiệm

| Thành viên | MSSV | Trách nhiệm chính |
| --- | --- | --- |
| Trần Văn Tiền | 52400320 | Frontend Next.js, tìm xe, chi tiết, dashboard, checklist |
| Triệu Minh Trí | 52400322 | NestJS, pricing, booking, Keyless và review |
| Đinh Hoàng Việt | 52400328 | PostgreSQL, Prisma, Google OIDC, lưu ảnh và môi trường |
| Trần Ngọc Minh Sang | 52400155 | Unit, integration, E2E API, Playwright và tổng hợp bằng chứng |

Một người dùng có thể vừa cho thuê xe vừa thuê xe. Owner chỉ quản lý xe của mình; Renter chỉ thao tác đơn của mình. Không được đặt xe do chính mình sở hữu. Quản trị vận hành không phải vai trò bắt buộc của giao diện MVP.

Trong MVP có Email/Password và Google OIDC, thông báo trong ứng dụng, private object storage và Keyless simulator. Apple login, email/SMS, Redis cache, Go microservice, thiết bị thật và thanh toán trực tuyến thuộc giai đoạn mở rộng.

## 2 Quy tắc nghiệp vụ dùng chung

- BR-01: API nhận ISO 8601 có timezone; chuyển UTC để lưu timestamptz và tính toán. Giao diện hiển thị Asia/Bangkok, ghi rõ múi giờ.
- BR-02: startAt phải ở tương lai tại lúc tạo đơn; endAt > startAt. Thời lượng từ 1 giờ đến 30 ngày. Giá nguyên dương VND, tối đa 100.000.000 đồng/ngày; tổng tiền phải nằm trong giới hạn số nguyên an toàn khi tính bằng TypeScript.
- BR-03: rentalDays = ceil((endAt - startAt) / 86.400.000). subtotal = rentalDays × pricePerDayVnd. serviceFeeVnd = 0, depositVnd = 0, totalVnd = subtotal trong MVP. Snapshot lưu phiên bản công thức, đơn giá và toàn bộ thành phần giá.
- BR-04: Lịch dùng khoảng [startAt, endAt). Hai khoảng chỉ tiếp giáp không xung đột. REQUESTED giữ lịch ngay; requestExpiresAt = min(createdAt + 24 giờ, startAt). APPROVED và IN_PROGRESS tiếp tục giữ lịch.
- BR-05: Hết thời hạn duyệt thì REQUESTED chuyển EXPIRED. Worker chạy mỗi phút; search bỏ qua hold đã hết hạn; create/approve xử lý hết hạn dưới khóa vehicle trước khi kiểm tra lịch. Không duyệt đơn đã EXPIRED.
- BR-06: Booking và calendar được đổi cùng transaction. Khóa hàng vehicle trước mọi thao tác ghi lịch. Exclusion constraint trên vehicle_calendar chặn các khoảng active giao nhau, bao gồm booking và khoảng bận chủ xe.
- BR-07: Idempotency-Key bắt buộc khi tạo booking. Phạm vi gồm user đã xác thực, operation và key. Hash nội dung chuẩn hóa gồm vehicleId, startAt UTC, endAt UTC, expectedTotalVnd và pricingVersion. Cùng khóa/cùng hash trả lại cùng booking; cùng khóa/khác hash trả 409 IDEMPOTENCY_MISMATCH. Khóa được giữ cùng booking, không tái sử dụng trong MVP.
- BR-08: REQUESTED và APPROVED được renter hủy trước startAt. Owner được từ chối REQUESTED và hủy APPROVED trước lúc nhận xe, bắt buộc lý do. Không hủy khi thao tác Keyless đang PENDING/UNKNOWN. IN_PROGRESS chỉ được hoàn tất qua trả xe hoặc xử lý vận hành có audit.
- BR-09: Mở khóa nhận xe chỉ khi actor là renter, trạng thái APPROVED, startAt <= now < endAt, checklist trước chuyến đã finalized và không có thao tác Keyless chưa giải quyết. Khi trả muộn vẫn cho khóa/trả xe; không tự tính phụ phí.
- BR-10: Checklist mỗi loại BEFORE/AFTER có 4 ảnh FRONT, REAR, LEFT, RIGHT; odometerKm nguyên không âm; fuelPercent 0–100; damageNotes tùy chọn tối đa 2.000 ký tự và xác nhận thông tin. Odo sau chuyến không nhỏ hơn trước chuyến. Bản finalized không sửa trực tiếp; bản điều chỉnh phải có lịch sử.
- BR-11: Ảnh JPEG/PNG tối đa 5 MiB mỗi file, kiểm tra kích thước, MIME và chữ ký file. Key do server sinh, không nhận đường dẫn tùy ý. Upload vào staging; sau kiểm tra server copy sang key finalized riêng để URL upload cũ không ghi đè bằng chứng. URL có thời hạn không được coi là chỉ dùng một lần.
- BR-12: Mỗi bên tham gia có tối đa một review cho một booking COMPLETED, điểm nguyên 1–5. Người nhận là bên còn lại; tác giả lấy từ phiên. Điểm xe tổng hợp review do renter viết, điểm renter từ review do owner viết. MVP chưa hỗ trợ chỉnh sửa review.
- BR-13: Dashboard tổng hợp subtotal của booking COMPLETED theo completedAt trong [from, to); giới hạn kỳ 366 ngày, quy đổi UTC từ ngày địa phương. Doanh thu ghi rõ là dự kiến từ chuyến hoàn tất, không phải tiền đã thu. Review không kích hoạt ghi nhận doanh thu.

Xe trả muộn cần cảnh báo cho chủ xe và booking tiếp theo. Calendar dự kiến không tự chứng minh xe đã có mặt; server phải kiểm tra không có booking IN_PROGRESS khác trước khi nhận xe. Việc xử lý xung đột trả muộn và điều chỉnh lịch phải được ghi audit, không âm thầm mở xe cho chuyến tiếp theo.

## 3 Đặc tả chức năng

### REQ CAR 01 Xác thực và tài khoản

Người dùng đăng ký Email/Password hoặc đăng nhập Google qua Authorization Code với state, nonce và PKCE. Server xác minh chữ ký ID token, issuer, audience, expiry và nonce bằng thư viện OIDC; nhận diện tài khoản theo provider và subject. Không tự liên kết tài khoản chỉ dựa vào email trùng. Mật khẩu dùng Argon2id; thông báo đăng nhập sai không tiết lộ tài khoản có tồn tại.

JWT access được ký HS256 với secret ngẫu nhiên, TTL 15 phút; JWT là token có chữ ký, không gọi là dữ liệu đã mã hóa. Refresh token ngẫu nhiên TTL 7 ngày, chỉ lưu hash, xoay khi refresh và thu hồi family khi phát hiện reuse. Cookie HttpOnly, Secure trên HTTPS, SameSite=Lax; request thay đổi dữ liệu kiểm tra Origin và CSRF token. Không lưu token vào localStorage. Tài khoản có thể sử dụng cả hai giao diện; quyền sở hữu luôn được kiểm tra trên server.

Đầu ra đăng nhập là cookie phiên và User DTO; không trả passwordHash hoặc refresh token trong JSON. Đăng xuất thu hồi phiên. API sai phiên trả 401; sai quyền trả 403 hoặc 404 khi cần che tài nguyên. Giới hạn đăng nhập 5 lần thất bại/phút/IP và tài khoản; cấu hình có thể điều chỉnh cho môi trường thử.

### REQ CAR 02 Đăng xe và quản lý lịch

Owner tạo nháp với hãng, model, năm sản xuất, biển số, tỉnh/thành, địa chỉ giao xe, loại xe, loại truyền động, số chỗ, tiện ích, mô tả và giá/ngày. Các giá trị danh mục lấy từ server. Biển số được chuẩn hóa và unique; năm từ 1980 đến năm hiện tại + 1, số chỗ 2–16. Ít nhất một ảnh xe đã kiểm tra trước khi publish. Giấy tờ xe có purpose riêng và không xuất hiện ở listing công khai.

Vehicle có DRAFT, PUBLISHED và ARCHIVED; tính rảnh được tính theo calendar, không dùng một cờ AVAILABLE cho mọi ngày. Owner sửa xe của mình; giá mới chỉ áp dụng booking mới. Archive ngừng nhận đơn mới, không phá các đơn đang có. Owner thêm/xóa khoảng bận dưới khóa vehicle; khoảng bận không được đè booking active.

### REQ CAR 03 Tìm kiếm và chi tiết xe

Renter hoặc khách tìm xe PUBLISHED theo city, startAt, endAt; tùy chọn minPrice, maxPrice, carType, transmission, seats, amenities và keylessSupported. Kết quả phân trang page từ 1, pageSize mặc định 12 và tối đa 50; sort priceAsc, priceDesc, ratingDesc hoặc newest, có id làm tie-breaker.

Search chỉ trả xe không có calendar active giao nhau và bỏ qua hold REQUESTED đã hết hạn. Khoảng giá là đơn giá/ngày VND. Mỗi kết quả có ảnh listing, đơn giá, báo giá tạm tính cho thời gian chọn, điểm trung bình và số review. Chi tiết xe có tiện ích, điều kiện thuê, review và trạng thái khả dụng. Không có kết quả thì trả danh sách rỗng cùng bộ lọc hiện tại. Booking vẫn kiểm tra lịch lại khi ghi; kết quả search không phải cam kết giữ xe.

### REQ CAR 04 Báo giá và tạo booking

API quote xác thực ngày và lấy đơn giá từ server, trả breakdown cùng pricingVersion. Quote không giữ lịch. Khi tạo booking, server lấy renter từ phiên, xác thực Idempotency-Key và hash; khóa vehicle; xử lý hold hết hạn; kiểm tra xe PUBLISHED, người thuê khác chủ và lịch rảnh; tính lại giá; ghi REQUESTED, PricingSnapshot, calendar, audit và idempotency thành công cùng transaction. Chênh lệch so với quote client gửi trả 409 PRICE_CHANGED kèm quote mới; không tự chấp nhận giá mới.

Lần tạo đầu trả 201; replay cùng nội dung trả 200 cùng bookingId và snapshotId với Idempotency-Replayed: true. Xung đột lịch trả 409 VEHICLE_UNAVAILABLE; hết thời gian giá/đầu vào sai trả lỗi nghiệp vụ được định nghĩa ở API. Lỗi trước commit không để lại booking hoặc calendar. Tranh chấp unique idempotency phải rollback rồi đọc lại kết quả đã commit và kiểm tra hash/quyền.

### REQ CAR 05 Vòng đời booking

Owner xem các yêu cầu cho xe của mình, duyệt hoặc từ chối khi REQUESTED còn hạn. Duyệt giữ nguyên calendar; từ chối giải phóng lịch. Renter xem đơn của mình và hủy theo BR-08. Mỗi chuyển trạng thái khóa vehicle rồi booking, kiểm tra trạng thái hiện tại và ghi audit cùng transaction. Thao tác lặp cùng trạng thái đích trả dữ liệu hiện tại nếu actor vẫn có quyền; thao tác không hợp lệ trả 409 INVALID_TRANSITION.

| Trạng thái đầu | Hành động | Người thực hiện và điều kiện | Trạng thái sau |
| --- | --- | --- | --- |
| REQUESTED | APPROVE | Owner, now < requestExpiresAt | APPROVED |
| REQUESTED | REJECT | Owner, còn hạn, có lý do | REJECTED |
| REQUESTED | CANCEL | Renter, now < startAt | CANCELLED |
| REQUESTED | EXPIRE | Worker/API, now >= requestExpiresAt | EXPIRED |
| APPROVED | CANCEL | Renter trước startAt; Owner trước lúc nhận, có lý do; không có Keyless chưa rõ | CANCELLED |
| APPROVED | START | Renter, đúng cửa sổ giờ, BEFORE finalized, Keyless xác nhận hoặc bàn giao thủ công đủ hai bên | IN_PROGRESS |
| IN_PROGRESS | COMPLETE | Renter, AFTER finalized, khóa xe được xác nhận hoặc bàn giao thủ công đủ hai bên | COMPLETED |

Terminal states REJECTED, CANCELLED, EXPIRED và COMPLETED giải phóng lịch. Không tự chuyển trạng thái chỉ vì giao diện bị vô hiệu hóa hoặc mất kết nối. Chuyến APPROVED quá giờ không tự thành COMPLETED; xử lý vận hành phải ghi lý do và lịch sử.

### REQ CAR 06 Checklist và Keyless

Renter chuẩn bị BEFORE sau khi APPROVED, AFTER khi IN_PROGRESS. Server kiểm tra quyền và tài nguyên ảnh đã verified. Finalize kiểm tra đủ 4 góc, odo, mức nhiên liệu và xác nhận. Điều kiện BEFORE không đồng nghĩa được nhận xe trước startAt; điều kiện AFTER cho phép trả sau endAt.

KeylessOperation gồm operationId, bookingId, action, status, provider, deviceResult và audit. Server ghi PENDING sau khi kiểm tra điều kiện; gọi adapter ngoài transaction bằng operationId; khi có xác nhận mới khóa và cập nhật booking. Để xử lý retry, adapter simulator phải idempotent theo operationId. UNKNOWN/timeout không tự chuyển booking thành công; retry giữ operationId và đối soát thiết bị trước khi gửi lại. Lỗi không được ghi thành thiết bị đã mở/khóa.

Bàn giao thủ công có bản ghi riêng gắn operation, lý do và xác nhận của owner lẫn renter. Khi đủ xác nhận, server kiểm tra lại quyền, checklist và trạng thái để chuyển booking, ghi provider=MANUAL. Không yêu cầu thiết bị báo OK giả. Không hủy booking khi operation PENDING/UNKNOWN; quá trình đối soát hoặc bàn giao phải giải quyết operation trước.

MVP dùng SimulatorKeylessAdapter với các chế độ success, failure, timeout và kết quả trễ. Adapter HTTP tương lai phải inject HttpService qua constructor, đăng ký HttpModule, kiểm tra response bằng schema, dùng URL cấu hình và service credential; không chuyển JWT của người thuê cho thiết bị.

### REQ CAR 07 Đánh giá và doanh thu

Sau COMPLETED, owner và renter gửi review độc lập theo BR-12. Server xác định bên nhận, kiểm tra tư cách tham gia và unique (bookingId, authorId). Điểm ngoài 1–5, nhận xét vượt 2.000 ký tự hoặc chuyến chưa hoàn tất bị từ chối. Bản review đã có không bị ghi đè.

Dashboard owner hiển thị số đơn theo trạng thái, số chuyến hoàn tất, tiền thuê dự kiến, tỷ lệ duyệt và danh sách xe. Tổng tiền lấy từ snapshot của booking COMPLETED trong kỳ completedAt; không cộng tiền cọc, không phụ thuộc thời điểm review và không cộng trùng do retry. API luôn suy ownerId từ phiên.

## 4 Kiến trúc và mô hình dữ liệu

Web Next.js gọi NestJS qua cùng origin /api/v1. NestJS chia module Auth, Users, Vehicles, Search, Pricing, Bookings, Inspections, Keyless, Reviews, Analytics, Media và Notifications. Domain calculator độc lập Prisma và HTTP. PostgreSQL là nguồn đúng cho lịch và giá đã chốt. Worker chạy cùng codebase và sử dụng cùng quy tắc khóa; không dùng in-memory mutex làm cơ chế duy nhất.

Danh mục bảng và ràng buộc được mô tả trong docs/DATABASE_DESIGN.md. API và DTO ở docs/API_CONTRACT.md. Hai tài liệu là phần triển khai của SRS này; khi thay đổi phải cập nhật cùng phiên bản. Mermaid trong tài liệu Markdown là nguồn sơ đồ để chỉnh sửa tiếp.

Ảnh được upload vào private staging bằng URL 300 giây. Server xác minh object và quyền, copy sang key final không cấp quyền PUT cho client, lưu checksum và metadata. URL xem ảnh kiểm tra chỉ cấp cho người tham gia booking, TTL 300 giây. Ảnh listing của xe PUBLISHED có thể được cấp URL đọc cho khách; giấy tờ và checklist luôn private. Không tồn tại endpoint đọc file theo đường dẫn/key do người dùng tùy ý chỉ định.

## 5 Yêu cầu phi chức năng và nghiệm thu

| Mã | Tiêu chí | Điều kiện đo và bằng chứng |
| --- | --- | --- |
| NFR-01 | Search P95 <= 2 giây; create booking P95 <= 500 ms | Staging 2 vCPU/4 GiB, DB 2 vCPU/4 GiB, 1.000 xe và 10.000 booking; 20 user đồng thời, warm-up 1 phút và đo 5 phút; báo cấu hình và log |
| NFR-02 | Không chấp nhận calendar active giao nhau | PostgreSQL thật; 20 request khác key cho cùng xe/khoảng giờ: 1 đơn thành công, 19 lỗi 409; kiểm tra constraint và bản ghi |
| NFR-03 | Coverage domain >= 80% branches và lines | Jest report cho Pricing, transition policy, overlap, checklist và review; không lấy tỷ lệ test cố định thay cho coverage |
| NFR-04 | Mọi API ghi kiểm tra phiên, quyền tài nguyên và CSRF | Ca 401/403/404, truy cập chéo tài khoản, upload và Keyless trực tiếp qua API |
| NFR-05 | Keyless simulator timeout 3.000 ms | Booking không đổi sang trạng thái thành công; operation UNKNOWN; có audit và ca bàn giao thủ công |
| NFR-06 | Mục tiêu availability 99% trong 30 ngày | Đo health check mỗi phút trên staging/production, gồm downtime có kế hoạch; chỉ báo đạt khi có đủ kỳ đo |

UI đáp ứng màn hình 360 px, 768 px và desktop; form có nhãn, lỗi cụ thể, thao tác bàn phím và trạng thái loading/empty/error. UI không hiển thị dữ liệu kỹ thuật như JWT, stack trace hoặc mã khóa thiết bị. Lỗi API có requestId để đối soát. Log không chứa mật khẩu, JWT, refresh token hoặc URL ký còn hiệu lực.

## 6 Danh sách màn hình

| Tuyến web | Nội dung chính |
| --- | --- |
| / và /vehicles | Tìm kiếm, bộ lọc, danh sách xe, phân trang |
| /vehicles/[id] | Chi tiết, review, lịch thuê, quote và gửi yêu cầu |
| /login và /register | Email/Password, Google và phản hồi lỗi |
| /account/bookings và /account/bookings/[id] | Lịch sử thuê, trạng thái, hủy, checklist, nhận/trả, review |
| /owner | Dashboard doanh thu dự kiến và yêu cầu chờ duyệt |
| /owner/vehicles và /owner/vehicles/[id]/edit | Nháp, publish/archive, ảnh và khoảng bận |
| /owner/bookings/[id] | Duyệt/từ chối, lịch sử, xác nhận bàn giao và review renter |
| /account | Thông tin người dùng, đăng xuất và phiên |

## 7 Truy vết yêu cầu và điều kiện hoàn thành

REQ-CAR-01 được nghiệm thu qua đăng ký, đăng nhập, Google OIDC, refresh rotation, logout và truy cập chéo. REQ-CAR-02 qua CRUD xe, upload ảnh, publish và chặn lịch. REQ-CAR-03 qua bộ lọc, phân trang và cùng quy tắc khoảng thời gian với booking. REQ-CAR-04 qua dữ liệu biên giá, snapshot, rollback, idempotency và tranh chấp. REQ-CAR-05 qua từng hàng trong bảng trạng thái. REQ-CAR-06 qua BEFORE/AFTER, simulator success/failure/timeout, retry và bàn giao thủ công. REQ-CAR-07 qua review hai chiều và tổng dashboard độc lập review.

Một chức năng chỉ hoàn tất khi có UI/API tương ứng, migration cần thiết, test liên quan đã chạy và log được lưu. Báo cáo kiểm thử mô tả thiết kế ca thử; không coi expected là kết quả thực tế. Phần cứng thật, thu tiền và vận hành 30 ngày cần bằng chứng riêng trước khi tuyên bố đã đáp ứng.

## 8 Tài liệu kỹ thuật tham chiếu

- Quyết định dự án: docs/DECISIONS.md.
- Hợp đồng API: docs/API_CONTRACT.md.
- Thiết kế dữ liệu: docs/DATABASE_DESIGN.md.
- Kế hoạch thực hiện: docs/IMPLEMENTATION_PLAN.md.
- PostgreSQL range constraint: https://www.postgresql.org/docs/current/rangetypes.html
- NestJS HTTP module: https://docs.nestjs.com/techniques/http-module
- Amazon S3 presigned URLs: https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html
- Google OpenID Connect: https://developers.google.com/identity/openid-connect/openid-connect
