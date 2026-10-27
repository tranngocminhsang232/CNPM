# Quyết định triển khai Car Sharing

Ngày chốt: 27/10/2026. Phiên bản đặc tả: 1.1. Các quyết định dưới đây áp dụng chung cho SRS, coding convention, API và kiểm thử.

| Mã | Quyết định | Lý do |
| --- | --- | --- |
| ADR-01 | Next.js và TypeScript cho web; NestJS theo module cho API; Prisma và PostgreSQL cho dữ liệu | Phù hợp phân công 4 thành viên và cho phép triển khai một backend thống nhất |
| ADR-02 | NestJS là modular monolith; chưa tách Go microservice và chưa dùng Redis trong MVP | Giảm môi trường phải vận hành; giữ logic lịch xe trong cùng giao dịch |
| ADR-03 | S3-compatible private bucket; MinIO cho local, cấu hình S3 cho môi trường triển khai | Cùng giao diện lưu trữ; tách quyền ảnh đăng xe và ảnh kiểm tra |
| ADR-04 | Google OAuth2/OIDC Authorization Code; Email/Password; một tài khoản có thể dùng cả Owner và Renter | Bao phủ yêu cầu OAuth2; chọn giao diện không thay thế kiểm tra quyền tài nguyên |
| ADR-05 | REQUESTED giữ lịch ngay; hết hạn ở min(createdAt + 24 giờ, startAt) | Tránh nhận nhiều đơn xung đột; giải phóng lịch khi chủ xe không phản hồi |
| ADR-06 | Khoảng lịch là [startAt, endAt); lưu UTC, hiển thị Asia/Bangkok | Cho phép chuyến sau bắt đầu đúng lúc chuyến trước kết thúc; phép so sánh thống nhất |
| ADR-07 | Đơn giá nguyên VND; thời lượng tối thiểu 1 giờ, tối đa 30 ngày; ceil(duration / 24 giờ) | Có quy tắc biên xác định và giới hạn giá trị đầu vào |
| ADR-08 | Giá MVP chỉ gồm tiền thuê; phí dịch vụ và tiền cọc đều bằng 0 | Đề bài chưa quy định phí; giữ ví dụ 600.000 đồng/ngày nhất quán; chưa tích hợp thu tiền |
| ADR-09 | Booking, snapshot giá, calendar và idempotency thành công được lưu cùng transaction | Không tạo đơn thiếu snapshot hoặc giữ lịch mồ côi |
| ADR-10 | Khóa hàng vehicle trước mọi thay đổi calendar; thêm exclusion constraint trên calendar | Tuần tự hóa thao tác cùng xe và có lớp bảo vệ ở PostgreSQL |
| ADR-11 | Idempotency theo (actorId, operation, key), gắn requestHash; giữ khóa cùng vòng đời booking | Gửi lại an toàn; cùng khóa khác nội dung trả 409; không trả dữ liệu người khác |
| ADR-12 | Keyless simulator là mặc định MVP; adapter phần cứng thật là hạng mục sau | Kiểm tra được thành công, lỗi và timeout mà không phụ thuộc mua thiết bị |
| ADR-13 | Timeout Keyless không chuyển trạng thái booking thành công; bàn giao thủ công cần hai bên xác nhận và audit | Phân biệt thiết bị đã phản hồi, kết quả chưa rõ và bàn giao được xác nhận |
| ADR-14 | Review unique theo (bookingId, authorId); chỉ hai người tham gia được đánh giá nhau | Cho phép đánh giá hai chiều, mỗi bên tối đa một lần |
| ADR-15 | Dashboard cộng tiền thuê của booking COMPLETED theo completedAt; ghi rõ doanh thu dự kiến | Không nhầm số tổng hợp chuyến với tiền đã thu thực tế; không phụ thuộc việc gửi review |
| ADR-16 | Phiên JWT access 15 phút, refresh 7 ngày; cookie HttpOnly; kiểm tra CSRF/Origin ở request thay đổi dữ liệu | Đồng bộ cách quản lý phiên và bảo vệ API dùng cookie |

## Quy tắc xử lý lịch

Booking giữ lịch ở REQUESTED, APPROVED và IN_PROGRESS. REJECTED, CANCELLED, EXPIRED và COMPLETED giải phóng calendar trong cùng giao dịch với thay đổi trạng thái. Chủ xe không được tạo khoảng bận đè lên booking đang giữ lịch. Mọi đường ghi calendar đều phải khóa cùng hàng vehicle trước.

Một worker quét hold hết hạn mỗi phút. API tìm xe bỏ qua hold đã hết hạn; API tạo booking và duyệt đơn khóa xe, xử lý hold hết hạn rồi mới quyết định tính khả dụng. Không dùng NOW() trong điều kiện của exclusion constraint. APPROVED không tự hết hạn khi đến giờ nhận; chuyến không đến nhận cần xử lý qua quy trình chủ xe hủy trước khi bắt đầu, có lý do và audit.

Hai khoảng xung đột khi a.start < b.end và a.end > b.start. Không tự thêm thời gian đệm giữa chuyến trong MVP. Nếu xe trả muộn, tạm ẩn xe khỏi search và chặn đơn mới; không mở rộng calendar đè lên đơn kế tiếp. START của chuyến tiếp theo phải kiểm tra không còn booking IN_PROGRESS khác. Ghi nhận sự cố, thông báo hai bên và xử lý có audit; không âm thầm thay đổi giá hoặc hủy đơn. Đây là rủi ro vận hành cần hiển thị rõ khi bàn giao, không được xem như lỗi đã giải quyết bằng phép so sánh lịch.

## Phạm vi nghiệm thu

MVP phải chạy trọn luồng tìm xe → đặt → chủ xe duyệt → checklist trước chuyến → nhận xe qua simulator → checklist sau chuyến → trả xe → đánh giá và dashboard. Google OIDC phải được cấu hình và kiểm tra thật trước khi đánh dấu REQ-CAR-01 hoàn tất. Keyless simulator chỉ chứng minh luồng phần mềm. Thanh toán trực tuyến, xác minh giấy phép lái xe tự động, bảo hiểm và phần cứng thật được ghi nhận ngoài MVP.

## Căn cứ kỹ thuật

- PostgreSQL range và exclusion constraint: https://www.postgresql.org/docs/current/rangetypes.html
- Prisma transaction và xử lý tranh chấp: https://www.prisma.io/docs/orm/v6/prisma-client/queries/transactions
- NestJS HttpModule và dependency injection: https://docs.nestjs.com/techniques/http-module
- S3 presigned URLs: https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html
- Google OIDC: https://developers.google.com/identity/openid-connect/openid-connect

Các chính sách 24 giờ, giá, phạm vi MVP và phân công là quyết định của dự án; không phải quy định do các nguồn kỹ thuật trên đặt ra.
