# Nhật ký sửa tài liệu ngày 27 tháng 10 năm 2026

- Bổ sung SRS phiên bản 1.1 với phạm vi MVP, 13 quy tắc nghiệp vụ, 7 yêu cầu chức năng, điều kiện nghiệm thu và danh sách màn hình.
- Thống nhất REQUESTED giữ lịch ngay, timeout hold 24 giờ hoặc đến startAt, thêm EXPIRED và quy tắc khoảng [start,end).
- Thay nhãn mã minh họa Production Ready bằng hợp đồng và thuật toán có phân biệt thiết kế với bằng chứng đã chạy.
- Thiết kế transaction lưu booking/snapshot/calendar/idempotency cùng nhau; quy định khóa vehicle và exclusion constraint.
- Bổ sung idempotency theo actor/scope/key và payload hash, null/invalid date/giá, price-changed và rollback.
- Chốt MVP phí dịch vụ và cọc bằng 0, thống nhất ví dụ tính giá và dashboard doanh thu dự kiến.
- Thay stream file cục bộ bằng luồng private object storage staging/verify/finalize; loại bỏ endpoint nhận đường dẫn tùy ý.
- Bổ sung operation Keyless, simulator, timeout không thành công, reconcile và manual confirmation hai phía.
- Thống nhất review unique theo booking/author; dashboard không phụ thuộc review.
- Chỉnh báo cáo Clean Code về phạm vi defensive copying và loại bỏ khẳng định bảo mật tuyệt đối/chất lượng chưa đo.
- Đồng bộ báo cáo kiểm thử về ca expiry, giá, snapshot, calendar, Keyless và trạng thái chưa thực thi.
- Thêm kế hoạch G0–G5, API contract và thiết kế DB. Source web, migration và bộ test ứng dụng sẽ được triển khai theo kế hoạch; chưa có kết quả build/test ứng dụng ở lần sửa tài liệu này.

Bản Word gốc được sao lưu ở backups/2026-10-27-originals trước khi thay đổi. Nội dung triển khai tiếp được duy trì bằng Markdown để dễ review diff.
