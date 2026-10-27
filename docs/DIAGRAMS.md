# Nguồn sơ đồ Car Sharing phiên bản 1.1

Các sơ đồ dưới đây áp dụng cùng quy tắc trong SRS.md. Hình trong Word được dựng lại từ các luồng này, không dùng lại sơ đồ giữ lịch từ lúc APPROVED của phiên bản cũ.

## Vai trò và chức năng

```mermaid
flowchart LR
    R[Renter] --> AUTH[UC01 Xác thực]
    O[Owner] --> AUTH
    O --> V[UC02 Đăng xe và lịch bận]
    R --> S[UC03 Tìm và xem xe]
    R --> B[UC04 Quote và đặt xe]
    O --> A[UC05 Duyệt và quản lý booking]
    R --> A
    R --> K[UC06 Checklist và Keyless]
    O --> K
    R --> REV[UC07 Đánh giá]
    O --> REV
    O --> DASH[Dashboard doanh thu dự kiến]
```

## Tạo và duyệt booking

```mermaid
flowchart TD
    Q[Tìm xe và quote] --> I[Kiểm tra idempotency và payload]
    I --> L[Khóa vehicle và dọn hold hết hạn]
    L --> C{Xe và lịch hợp lệ?}
    C -- Không --> E[409 hoặc lỗi đầu vào]
    C -- Có --> T[Transaction booking REQUESTED + snapshot + calendar + key + event]
    T --> O{Owner xử lý trước hạn?}
    O -- Duyệt --> A[APPROVED giữ nguyên lịch]
    O -- Từ chối --> R[REJECTED và giải phóng lịch]
    O -- Hết hạn --> X[EXPIRED và giải phóng lịch]
```

## Trạng thái booking

```mermaid
stateDiagram-v2
    [*] --> REQUESTED
    REQUESTED --> APPROVED: Owner duyệt còn hạn
    REQUESTED --> REJECTED: Owner từ chối
    REQUESTED --> CANCELLED: Renter hủy trước startAt
    REQUESTED --> EXPIRED: Hết hạn chờ duyệt
    APPROVED --> CANCELLED: Hủy hợp lệ và không có operation chưa rõ
    APPROVED --> IN_PROGRESS: BEFORE và START được xác nhận
    IN_PROGRESS --> COMPLETED: AFTER và COMPLETE được xác nhận
    COMPLETED --> [*]
    REJECTED --> [*]
    CANCELLED --> [*]
    EXPIRED --> [*]
```

## Keyless

```mermaid
flowchart TD
    C[Server kiểm tra actor + state + checklist + thời gian] --> P[Tạo operation PENDING và commit]
    P --> K[Gọi simulator ngoài transaction bằng operationId]
    K --> R{Kết quả?}
    R -- Xác nhận --> S[SUCCEEDED và chuyển booking đúng một lần]
    R -- Lỗi chắc chắn --> F[FAILED và giữ trạng thái booking]
    R -- Timeout hoặc chưa rõ --> U[UNKNOWN và giữ trạng thái booking]
    U --> REC[Reconcile cùng operationId]
    F --> M[Bàn giao thủ công có lý do]
    U --> M
    M --> TWO[Owner và renter cùng xác nhận]
    TWO --> V[Kiểm tra lại và chuyển booking với provider MANUAL]
```

## Tuần tự thao tác thiết bị

```mermaid
sequenceDiagram
    participant UI as Web
    participant API as NestJS
    participant DB as PostgreSQL
    participant K as Keyless Simulator
    UI->>API: START hoặc COMPLETE và key
    API->>DB: Kiểm tra quyền/checklist, ghi operation PENDING
    DB-->>API: Commit operationId
    API-->>UI: 202 operationId
    API->>K: Command với cùng operationId
    alt Xác nhận thành công
      K-->>API: Kết quả xác định
      API->>DB: Khóa vehicle/booking, ghi kết quả và chuyển trạng thái
    else Timeout hoặc chưa rõ
      API->>DB: UNKNOWN, booking giữ nguyên
    end
    UI->>API: GET operation
    API-->>UI: Kết quả hiện tại
```

Mô hình ER đầy đủ nằm trong DATABASE_DESIGN.md. Thao tác nhận xe còn kiểm tra không có chuyến IN_PROGRESS khác, kể cả khi lịch dự kiến chỉ tiếp giáp.
