# Car Sharing và Keyless Rental

Dự án Nhóm 7 theo Topic 18. Trạng thái hiện tại: chuẩn bị đặc tả và kế hoạch; chưa có source ứng dụng chạy được.

- [Kế hoạch xây dựng web](docs/IMPLEMENTATION_PLAN.md)
- [SRS phiên bản 1.1](docs/SRS.md)
- [Quyết định nghiệp vụ và kiến trúc](docs/DECISIONS.md)
- [Hợp đồng API](docs/API_CONTRACT.md)
- [Thiết kế CSDL](docs/DATABASE_DESIGN.md)
- [Nhật ký sửa tài liệu](docs/CHANGELOG_REVIEW.md)
- [Bàn giao cho Gemini và prompt khởi động](docs/GEMINI_HANDOFF.md)
- [Task cards triển khai G0](docs/tasks/G0_TASKS.md)
- [Tiến độ theo từng task](docs/PROGRESS.md)

Ba báo cáo Word ở thư mục gốc được cập nhật theo cùng quyết định. Bản gốc trước sửa nằm trong backups/2026-10-27-originals.

Bước triển khai tiếp theo là G0: tạo Next.js/NestJS workspace, môi trường PostgreSQL/object storage, migration, seed và vertical slice danh sách xe. Các lệnh cài đặt/build/test sẽ được bổ sung khi scaffold hoàn tất; chưa có lệnh ứng dụng để chạy ở trạng thái hiện tại.

Khi chuyển sang Gemini, giao G0-00 trước để kiểm tra môi trường và chọn/pin bộ phiên bản tương thích. Làm từng task có prerequisite và tiêu chí kiểm tra, rồi cập nhật PROGRESS.md; không cần chờ người khác dựng source trước khi bàn giao.
