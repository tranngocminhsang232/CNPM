# Hợp đồng API Car Sharing

Phiên bản 1.1, 27/10/2026. Base path `/api/v1`. Đây là hợp đồng dự kiến để triển khai, chưa phải API đã chạy. OpenAPI sẽ được sinh từ DTO/controller tại giai đoạn G0 và đối chiếu với tài liệu này.

## Quy ước chung

- JSON dùng camelCase; ID là UUID; thời gian ISO 8601 có timezone và phản hồi dạng UTC. Tiền là số nguyên VND.
- Cookie access/refresh HttpOnly; API thay đổi dữ liệu yêu cầu `X-CSRF-Token` gắn phiên và Origin hợp lệ. `/auth/csrf` cấp token; đăng ký/đăng nhập cũng cần kiểm tra CSRF/Origin với token trước phiên. OIDC callback kiểm tra state/nonce/PKCE riêng.
- API chỉ lấy actorId từ phiên. Không tin ownerId, renterId, authorId hoặc các cờ quyền do client gửi.
- Thành công trả `{ data, meta? }`. Danh sách trả `{ data: [], meta: { page, pageSize, total, totalPages } }`. Lỗi trả `{ error: { code, message, details? }, requestId }`.
- 400: JSON/tham số sai; 401: phiên không hợp lệ; 403: hành động không được phép; 404: không có tài nguyên hoặc che tài nguyên riêng của người khác; 409: xung đột nghiệp vụ; 413: ảnh quá dung lượng; 415: định dạng ảnh không hỗ trợ; 422: đầu vào hợp lệ cú pháp nhưng sai nghiệp vụ; 429: rate limit; 503: lỗi phụ thuộc tạm thời.
- Không nhận URL ảnh tùy ý vào DTO. Client gửi mediaId đã được server xác minh.

## Auth và tài khoản

| Method và route | Đầu vào chính | Kết quả |
| --- | --- | --- |
| GET /auth/csrf | Không | 200 CSRF token |
| POST /auth/register | name 2–100 ký tự, email, password 12–128 ký tự | 201 UserDto và cookie; email trùng 409 EMAIL_IN_USE |
| POST /auth/login | email, password | 200 UserDto và cookie; sai thông tin 401 INVALID_CREDENTIALS |
| GET /auth/google | Redirect nội bộ allowlist | 302 tới provider, tạo state/nonce/PKCE server-side |
| GET /auth/google/callback | code, state | 302 về web; kiểm tra ID token rồi đặt cookie |
| POST /auth/refresh | Cookie refresh và CSRF token | 200 phiên xoay token; reuse thu hồi family và 401 |
| POST /auth/logout | Cookie phiên | 204, thu hồi phiên và xóa cookie; UI chuyển đăng nhập |
| GET /me | Phiên | 200 UserDto không có hash/token |
| PATCH /me | name, phone tùy chọn | 200 UserDto |

UserDto: `{ id, name, email, phone, capabilities: ['RENTER','OWNER'] }`. Giao diện đang chọn chỉ là preference; không cấp quyền quản lý xe của người khác. Xử lý email/password và OIDC account linking tách biệt; liên kết tài khoản hiện có cần phiên đã xác thực, ngoài MVP.

## Xe và lịch chủ xe

| Method và route | Đầu vào chính | Kết quả và quyền |
| --- | --- | --- |
| GET /vehicle-options | Không | 200 danh mục city, loại xe, transmission, amenities |
| GET /vehicles | city, startAt, endAt; bộ lọc theo SRS; page, pageSize, sort | 200 danh sách PUBLISHED; khách được đọc |
| GET /vehicles/:id | startAt/endAt tùy chọn, phải đi cùng nhau | 200 chi tiết public; DRAFT/ARCHIVED chỉ owner |
| GET /owner/vehicles | page, pageSize, status tùy chọn | 200 xe của actor |
| POST /owner/vehicles | brand, model, year, plate, city, pickupAddress, carType, transmission, seats, amenities, description, pricePerDayVnd, keylessSupported | 201 DRAFT; giá/mã danh mục sai 422 |
| PATCH /owner/vehicles/:id | Các trường được sửa; version bắt buộc | 200; version cũ 409 STALE_VERSION |
| POST /owner/vehicles/:id/publish | version | 200 PUBLISHED; chưa có ảnh verified 422 PHOTO_REQUIRED |
| POST /owner/vehicles/:id/archive | version | 200 ARCHIVED; booking đã có vẫn hợp lệ |
| POST /owner/vehicles/:id/blocks | startAt, endAt, reason tối đa 500 ký tự | 201 block; xung đột 409 VEHICLE_UNAVAILABLE |
| DELETE /owner/vehicles/:id/blocks/:blockId | Không | 204, chỉ block của xe actor sở hữu |

VehicleSummaryDto: `{ id, brand, model, city, carType, transmission, seats, amenities, keylessSupported, pricePerDayVnd, coverImageUrl, ratingAverage, reviewCount, quote? }`. Không trả plate, giấy tờ hoặc địa chỉ chính xác trong kết quả public; pickupAddress chỉ cho owner và renter có booking APPROVED/IN_PROGRESS/COMPLETED. Ngày local được UI chuyển UTC trước khi gửi.

## Quote và booking

| Method và route | Đầu vào chính | Kết quả |
| --- | --- | --- |
| POST /pricing/quote | vehicleId, startAt, endAt | 200 QuoteDto; không giữ lịch, khách được xem |
| POST /bookings | Header Idempotency-Key; vehicleId, startAt, endAt, expectedTotalVnd, pricingVersion | 201 tạo mới, 200 replay |
| GET /bookings | perspective=renter/owner, status?, page, pageSize | 200 chỉ đơn actor tham gia |
| GET /bookings/:id | Không | 200 BookingDetailDto, checklist, snapshot và audit đã lọc |
| POST /bookings/:id/approve | Không | 200 APPROVED |
| POST /bookings/:id/reject | reason 1–500 ký tự | 200 REJECTED |
| POST /bookings/:id/cancel | reason 1–500 ký tự | 200 CANCELLED |

QuoteDto: `{ vehicleId, startAt, endAt, pricePerDayVnd, rentalDays, subtotalVnd, serviceFeeVnd: 0, depositVnd: 0, totalVnd, pricingVersion: 'daily-v1' }`.

BookingDetailDto: `{ id, vehicleId, renterId, ownerId, startAt, endAt, status, requestExpiresAt, snapshotId, pricingSnapshot, createdAt, completedAt?, version }`. User DTO trong booking chỉ chứa thông tin cần thiết cho hai bên; không trả credentials.

Idempotency-Key dài 16–128 ký tự ASCII gồm chữ, số, `-` và `_`; web dùng UUID. Hash canonical gồm vehicleId, startAt UTC, endAt UTC, expectedTotalVnd và pricingVersion. Scope cố định `CREATE_BOOKING` cùng actorId. Khi đã có kết quả thành công, cùng hash trả booking hiện tại cùng snapshot gốc, không kiểm tra lại startAt tương lai và không giữ lịch lần nữa. Khác hash trả 409 IDEMPOTENCY_MISMATCH. Xung đột cùng key trong lúc commit được xử lý bằng unique constraint rồi replay sau rollback.

`PRICE_CHANGED` trả 409 với `details.quote` mới để người dùng xác nhận và dùng key mới. Không có xe trả 404 VEHICLE_NOT_FOUND; tự đặt xe mình 403 SELF_BOOKING_FORBIDDEN; trùng lịch 409 VEHICLE_UNAVAILABLE; hold hết hạn 409 BOOKING_EXPIRED; sai thời lượng 422 INVALID_RENTAL_PERIOD; chuyển trạng thái sai 409 INVALID_TRANSITION. Nếu lỗi hạ tầng chưa rõ commit, web retry với cùng key.

## Media và checklist

| Method và route | Đầu vào chính | Kết quả |
| --- | --- | --- |
| POST /media/upload-intents | purpose=VEHICLE_PHOTO/VEHICLE_DOCUMENT/INSPECTION_PHOTO, vehicleId hoặc bookingId, mimeType, sizeBytes | 201 `{ mediaId, uploadUrl, headers, expiresAt }`, key staging do server sinh |
| POST /media/:id/verify | Không | 200 verified sau kiểm tra object và copy sang key final; sai ảnh 415/413 |
| GET /media/:id/read-url | Không | 200 `{ url, expiresAt }`, kiểm tra quyền/purpose |
| POST /owner/vehicles/:id/photos | mediaId, position | 201 photo attachment, chỉ VEHICLE_PHOTO đã verified |
| DELETE /owner/vehicles/:id/photos/:mediaId | Không | 204 detach; không xóa chứng cứ checklist |
| PUT /bookings/:id/inspections/:type | type=BEFORE/AFTER; photos `{ angle, mediaId }[]`, odometerKm, fuelPercent, damageNotes, acknowledged, version | 200 bản nháp |
| POST /bookings/:id/inspections/:type/finalize | version | 200 finalized; thiếu 4 góc 422 CHECKLIST_INCOMPLETE |

Draft inspection được tạo khi PUT lần đầu với version=0; cập nhật cần version hiện tại. Unique (bookingId,type) và (inspectionId,angle). Renter là người điền; owner được xem và xác nhận bàn giao. Không finalize từ client bằng cờ checklistComplete. Server đọc dữ liệu đã lưu. File staging chưa verify không xuất hiện trong listing/checklist; URL upload cũ không được ghi đè final key.

## Keyless và bàn giao thủ công

| Method và route | Đầu vào chính | Kết quả |
| --- | --- | --- |
| POST /bookings/:id/keyless-operations | action=START/COMPLETE; header Idempotency-Key | 202 `{ operationId, status, bookingStatus }` |
| GET /bookings/:id/keyless-operations/:operationId | Không | 200 trạng thái PENDING/SUCCEEDED/FAILED/UNKNOWN/MANUAL_CONFIRMED |
| POST /bookings/:id/keyless-operations/:operationId/reconcile | Không | 202, đối soát cùng operationId; rate limit |
| POST /bookings/:id/manual-handovers | operationId, action, reason | 201 bản ghi bàn giao; gắn operation lỗi/chưa rõ |
| POST /bookings/:id/manual-handovers/:handoverId/confirm | acknowledged=true | 200 xác nhận của actor; chuyển booking khi đủ hai bên và điều kiện đạt |

Mỗi operation có scope key theo actor, booking và action, hash action/booking; cùng key trả operation cũ, khác nội dung trả 409. Không tạo operation mới khi cùng booking/action đang PENDING/UNKNOWN. Lỗi timeout không phải thành công; booking vẫn APPROVED hoặc IN_PROGRESS. START dùng BEFORE và cửa sổ nhận xe; COMPLETE dùng AFTER và cho phép quá giờ. Simulator test mode chỉ có ở môi trường test/dev, không nhận tham số đổi chế độ từ người dùng production.

## Review và dashboard

| Method và route | Đầu vào chính | Kết quả |
| --- | --- | --- |
| POST /bookings/:id/reviews | score nguyên 1–5, comment tối đa 2.000 ký tự | 201; trùng tác giả 409 ALREADY_REVIEWED; chưa hoàn tất 409 BOOKING_NOT_COMPLETED |
| GET /vehicles/:id/reviews | page, pageSize | 200 review renter của xe PUBLISHED |
| GET /owner/analytics | from, to UTC, khoảng tối đa 366 ngày | 200 `{ completedTrips, projectedRevenueVnd, requestedCount, approvedCount }` |
| GET /notifications | page, pageSize | 200 thông báo của actor |
| POST /notifications/:id/read | Không | 200, chỉ của actor |

Dashboard đọc snapshot theo booking.completedAt, không dựa trên bảng review. Nghiệm thu API cần kiểm tra từng route qua server chạy thật với PostgreSQL thử. Không dùng trạng thái nút trên UI làm bằng chứng API đã kiểm tra quyền.
