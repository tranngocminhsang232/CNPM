#!/usr/bin/env bash
# ==============================================================================
# CAR SHARING & KEYLESS RENTAL PLATFORM - TRÌNH KHỞI ĐỘNG (macOS / Linux)
# ==============================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "=============================================================================="
echo "      CAR SHARING VÀ KEYLESS RENTAL PLATFORM - TRÌNH KHỞI ĐỘNG TỰ ĐỘNG"
echo "=============================================================================="
echo ""

# 1. Kiểm tra Docker
echo "[1/5] Kiểm tra trạng thái Docker Engine..."
if ! docker info >/dev/null 2>&1; then
  echo "  -> Docker daemon chưa chạy."
  if [[ "$OSTYPE" == "darwin"* ]] && [ -d "/Applications/Docker.app" ]; then
    echo "  -> Đang khởi động Docker Desktop trên macOS..."
    open -a Docker
  fi
  echo "  -> Đang chờ Docker Engine sẵn sàng (tối đa 120s)..."
  wait_count=0
  while ! docker info >/dev/null 2>&1; do
    sleep 2
    wait_count=$((wait_count + 1))
    if [ $wait_count -ge 60 ]; then
      echo ""
      echo "  [!] Docker chưa sẵn sàng sau 120s."
      echo "      Vui lòng bật Docker Desktop/Daemon thủ công rồi chạy lại script."
      exit 1
    fi
  done
fi
echo "  [OK] Docker Engine đã sẵn sàng!"
echo ""

# 2. Khởi động PostgreSQL 18 và MinIO S3
echo "[2/5] Khởi động Database PostgreSQL 18 và MinIO S3 Containers..."
docker compose -f infra/compose.yaml up -d
echo "  -> Đang chờ PostgreSQL trên port 5433..."
until node -e 'require("net").createConnection(5433, "127.0.0.1").on("connect", () => process.exit(0)).on("error", () => process.exit(1))' 2>/dev/null; do
  sleep 1
done
echo "  [OK] Containers đã sẵn sàng trên port 5433 (DB) và 9000 (S3)!"
echo ""

# 3. Đồng bộ Prisma Migrations
echo "[3/5] Đồng bộ schema cơ sở dữ liệu..."
pnpm exec prisma migrate deploy
echo "  [OK] Schema CSDL đã sẵn sàng!"
echo ""

# 4. Giải phóng port cũ nếu có
echo "[4/5] Giải phóng port 3000 và 4000 (nếu có)..."
if command -v lsof >/dev/null 2>&1; then
  lsof -ti:3000,4000 | xargs kill -9 2>/dev/null || true
elif command -v fuser >/dev/null 2>&1; then
  fuser -k 3000/tcp 4000/tcp 2>/dev/null || true
fi
echo "  [OK] Cổng mạng 3000 và 4000 đã sẵn sàng!"
echo ""

# 5. Mở trình duyệt và khởi động song song Backend + Frontend
echo "[5/5] Khởi động Backend API (Port 4000) và Web Frontend (Port 3000)..."
(
  sleep 6
  if [[ "$OSTYPE" == "darwin"* ]]; then
    open http://localhost:3000
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open http://localhost:3000
  fi
) &

echo "=============================================================================="
echo "[THÀNH CÔNG] Toàn bộ hệ thống đang được khởi chạy!"
echo ""
echo "  * Giao diện Web (Frontend) : http://localhost:3000"
echo "  * Cơ sở dữ liệu / API      : http://localhost:4000/api/v1"
echo "  * Tài khoản Demo có sẵn:"
echo "      - Người thuê (Renter)  : renter1@carsharing.local / DemoPassword123!"
echo "      - Chủ xe (Host 1)      : owner1@carsharing.local / DemoPassword123!"
echo "      - Chủ xe (Host 2)      : owner2@carsharing.local / DemoPassword123!"
echo ""
echo "  (Nhấn nút Đăng nhập nhanh trên giao diện Web để vào ngay không cần gõ mật khẩu)"
echo ""
echo "  * Để dừng hệ thống: Nhấn Ctrl + C hoặc chạy ./stop-dev.sh"
echo "  * Để xem CSDL qua web: Chạy ./start-studio.sh"
echo "=============================================================================="
echo ""

pnpm run dev
