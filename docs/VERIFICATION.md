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

## Những phần chưa thực thi

Chưa có source web/API, package.json hoặc database migration thực tế, nên chưa chạy build, Jest, Supertest, Playwright, concurrency/load test hoặc Google OAuth integration. Chưa tích hợp phần cứng Keyless thật, S3 production hoặc thu tiền. Các ca AT01–AT16 và NFR trong báo cáo là thiết kế nghiệm thu, chưa phải kết quả ứng dụng đã đạt.

19 kiểm tra calculator chỉ xác nhận ví dụ được ghi trong báo cáo, không chứng minh API, transaction hoặc toàn bộ hệ thống đã hoạt động. Các script ứng dụng và pipeline được tạo, chạy và ghi bằng chứng ở G0 trở đi theo IMPLEMENTATION_PLAN.md.
