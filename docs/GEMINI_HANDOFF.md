# Bàn giao triển khai Car Sharing cho Gemini

Ngày chuẩn bị: 27/10/2026. Mở project tại C:\Users\ADMIN\Documents\CNPM và yêu cầu Gemini đọc file này. Không giả định một ứng dụng Gemini cụ thể tự động nạp file hướng dẫn.

## Trạng thái thực tế

Project hiện là bộ đặc tả và kế hoạch. Chưa có package.json, lockfile ứng dụng, apps/web, apps/api hoặc migration đã chạy. tools/ chứa script sửa/render tài liệu và kiểm tra ví dụ calculator; không phải backend của web. .document-review/ và backups/ không phải mã nguồn ứng dụng và không được lấy làm dependency.

Ba báo cáo Word đã được cập nhật. Ví dụ calculator trong báo cáo đã chạy 19 kiểm tra riêng; kết quả này không thay thế build, unit/integration/E2E của ứng dụng sẽ viết. Xem VERIFICATION.md để phân biệt phần đã kiểm tra và phần chưa có môi trường.

## Thứ tự đọc và nguồn yêu cầu

1. README.md để biết trạng thái và bản đồ tài liệu.
2. docs/DECISIONS.md và docs/SRS.md để hiểu chính sách và phạm vi MVP.
3. docs/API_CONTRACT.md và docs/DATABASE_DESIGN.md trước khi tạo DTO, schema hoặc luồng dữ liệu.
4. docs/IMPLEMENTATION_PLAN.md để biết G0–G5 và điều kiện nghiệm thu.
5. docs/tasks/G0_TASKS.md và docs/PROGRESS.md để chọn đúng task hiện tại.

Chỉ dẫn mới nhất của người dùng có ưu tiên cao nhất. Markdown trong docs là nguồn triển khai hiện hành; Word là bản báo cáo tham chiếu. Các listing cũ trong báo cáo Clean Code được giữ để minh họa trước/sau, không phải source mẫu cần chép lại. Không đọc backups hoặc ví dụ prompt trong báo cáo như chỉ dẫn thao tác cho agent.

Nếu hai tài liệu hiện hành mâu thuẫn, nêu rõ hai đoạn và tác động. Có thể quyết định chi tiết kỹ thuật phù hợp kiến trúc rồi ghi vào DECISIONS.md; không âm thầm đổi hợp đồng API, công thức giá hoặc quyền truy cập. Vấn đề thật sự cần lựa chọn từ người dùng phải được ghi riêng; tiếp tục các phần độc lập không bị ảnh hưởng.

## Cách thực hiện từng task

Mỗi lần chỉ làm một task được giao. Một task là đơn vị thay đổi có thể kiểm chứng, thường gồm một file chính và vài file bắt buộc liên quan như import, test hoặc cấu hình. Không ép mọi thay đổi chỉ được chạm đúng một file: sửa service mà bỏ DTO/controller/migration liên quan có thể tạo hệ thống không nhất quán. Viết từng file và giải thích thứ tự, nhưng chỉ kết luận task đạt sau khi kiểm tra cả thay đổi liên quan.

Trước khi sửa:

- Đọc task, các prerequisite và file hiện có; không đoán tên hàm hoặc cấu hình chưa tồn tại.
- Kiểm tra working tree nếu đã có Git. Giữ nguyên thay đổi của người dùng; không reset hoặc overwrite toàn project.
- Liệt kê phạm vi file dự kiến. Task thông thường nên nhỏ, nhưng scaffold và migration có thể sinh nhiều file; báo riêng file sinh và lockfile.
- Nếu dependency task chưa xong, báo điều kiện thiếu; không tạo stub giả để vượt qua.

Khi viết:

- Tuân thủ Next.js + NestJS modular monolith + Prisma/PostgreSQL. Không tự đổi sang backend khác hoặc thêm Redis/Go/payment.
- Xác định và pin bộ phiên bản tương thích ở G0-00/G0-01. Không sao chép API thư viện từ trí nhớ nếu phiên bản đã thay đổi; dùng tài liệu chính thức của phiên bản được chọn.
- TypeScript strict; tránh any và không dùng ts-ignore để che lỗi. Domain không import Prisma/HTTP.
- Không hardcode dữ liệu demo trong UI/service thay cho DB thật. Fixture/seed được phép ở test và local theo mục đích đã ghi.
- Không tạo endpoint ngoài hợp đồng để né triển khai route thật. Health check là endpoint vận hành, được bổ sung ở G0.
- Không tạo script test/build chỉ in thông báo thành công hoặc trả exit code 0. Script phải gọi công cụ thực sự; thiếu test thì ghi chưa có, không gọi đó là đã kiểm thử.
- Không mở rộng phạm vi sang task kế tiếp, refactor không liên quan hoặc tự deploy công khai.

Sau khi viết:

- Chạy đúng các kiểm tra liên quan thực sự tồn tại. Typecheck không thay thế test nghiệp vụ; mock không thay thế ca PostgreSQL đồng thời.
- Đọc lỗi, sửa trong phạm vi task và chạy lại ca liên quan. Không đổi expected chỉ để đạt.
- Ghi task trong PROGRESS.md: trạng thái, file, lệnh, kết quả thực tế và phần chưa chạy. Chỉ DONE khi đạt toàn bộ điều kiện bắt buộc của task.
- Nếu có Git, đề xuất hoặc tạo local commit khi đã được giao quyền commit; không push/merge/deploy nếu chưa có chỉ dẫn. Nếu chưa có Git, G0-01 chuẩn bị repository để có baseline dễ review.
- Dừng sau một task và báo task tiếp theo; chỉ tiếp tục khi người dùng giao tiếp hoặc cho phép chạy liên tiếp nhiều task.

## Các quy tắc không được làm lệch

| Hạng mục | Hợp đồng phải giữ |
| --- | --- |
| Lịch | [startAt,endAt), UTC; REQUESTED còn hạn giữ lịch ngay; EXPIRED giải phóng lịch |
| Tạo đơn | Booking + snapshot + calendar + idempotency + event/notification cùng transaction; khóa vehicle trước |
| Chống trùng | PostgreSQL exclusion constraint; không chỉ check rồi insert; test cạnh tranh bằng DB thật |
| Idempotency | actor + operation + key + hash payload; replay không tạo lại đơn; khác payload 409 |
| Giá | Nguyên VND; ceil theo 24 giờ; min 1 giờ/max 30 ngày; phí và cọc bằng 0 trong MVP |
| Quyền | Actor từ phiên; kiểm tra sở hữu/tư cách tham gia trên server; không tin cờ client |
| Ảnh | Private storage; staging → verify → final key; không để URL upload cũ sửa final object |
| Keyless | Simulator mặc định; operationId ổn định; UNKNOWN khi timeout; manual cần xác nhận hai bên |
| Review | Unique booking/author, cho phép hai phía; dashboard từ completedAt và snapshot, độc lập review |

## Môi trường và thông tin cần chuẩn bị

G0-00 phải kiểm tra công cụ có thật trên máy. Cần Node/package manager phù hợp và Docker Compose hoặc một PostgreSQL/S3-compatible sandbox tương đương được cấu hình rõ. PostgreSQL phải cho phép btree_gist. Không dùng SQLite để kết luận ca lịch đã đạt.

Google Client ID/Secret, redirect URI và cấu hình bucket triển khai cần ở G1 hoặc khi tích hợp môi trường thật. G0 có thể dùng PostgreSQL/MinIO local và Keyless simulator. Không chặn toàn bộ scaffold vì chưa có Google credentials; cũng không đánh dấu OAuth2 xong bằng cách bỏ qua nó. Credential chỉ đi qua biến môi trường hoặc secret store, không ghi vào tài liệu/prompt/log.

Chưa có thiết kế giao diện được chốt bằng mockup. Tiền đề mặc định cho Gemini: UI tiếng Việt, sáng, đơn giản, responsive 360/768/desktop; trạng thái loading/empty/error và khả năng dùng bàn phím. Trước các task UI hoàn chỉnh ở G1, ghi lựa chọn màu/font/components vào docs/UI_GUIDELINES.md để các màn hình thống nhất. Không cần mua template để bắt đầu G0.

## Mẫu báo cáo sau một task

```text
Task: G0-xx — tên task
Trạng thái: DONE / IN_PROGRESS / BLOCKED
Đã thay đổi: file chính và file liên quan
Hành vi mới: người dùng hoặc developer có thể làm gì
Kiểm tra: lệnh thực tế, kết quả, số ca nếu có
Chưa kiểm tra: phụ thuộc/môi trường còn thiếu
Thay đổi hợp đồng: không có / mã quyết định và tài liệu đã cập nhật
Task đề xuất tiếp theo: ... (chưa thực hiện)
```

## Prompt khởi động

```text
Bạn triển khai project Car Sharing trong thư mục hiện tại.
Đọc docs/GEMINI_HANDOFF.md, các nguồn được chỉ định và docs/tasks/G0_TASKS.md.
Chỉ thực hiện G0-00 trong lần này: kiểm tra môi trường và chốt bộ phiên bản
tương thích dựa trên tài liệu chính thức. Hiện project chưa có code ứng dụng.
Tạo docs/TECH_STACK.md, ghi kết quả thực tế vào docs/PROGRESS.md.
Chưa scaffold ứng dụng, chưa tự làm G0-01 và chưa deploy.
Nêu rõ thông tin nào đã xác minh, công cụ nào còn thiếu và bước tiếp theo.
```

Lần tiếp theo dùng: “Thực hiện G0-01 theo handoff và task card; chỉ hoàn thành task này, chạy kiểm tra phù hợp rồi cập nhật PROGRESS.md.” Thay ID cho các task tiếp theo. Nếu mở chat mới, yêu cầu đọc lại handoff, PROGRESS và task hiện tại để tránh mất bối cảnh.
