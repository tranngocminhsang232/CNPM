#!/usr/bin/env bash
# ==============================================================================
# PRISMA STUDIO - GIAO DIỆN QUẢN TRỊ CSDL CHO macOS / Linux
# ==============================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "=============================================================================="
echo "      PRISMA STUDIO - GIAO DIỆN QUẢN TRỊ CƠ SỞ DỮ LIỆU (POSTGRESQL)"
echo "=============================================================================="
echo ""

# 1. Kiểm tra Docker
echo "[1/4] Kiểm tra Docker Engine..."
if ! docker info >/dev/null 2>&1; then
  echo "  -> Docker daemon chưa chạy."
  if [[ "$OSTYPE" == "darwin"* ]] && [ -d "/Applications/Docker.app" ]; then
    echo "  -> Đang khởi động Docker Desktop trên macOS..."
    open -a Docker
  fi
  echo "  -> Đang chờ Docker Engine sẵn sàng..."
  wait_count=0
  while ! docker info >/dev/null 2>&1; do
    sleep 2
    wait_count=$((wait_count + 1))
    if [ $wait_count -ge 60 ]; then
      echo "  [!] Docker chưa sẵn sàng sau 120s. Vui lòng bật Docker Desktop/Daemon rồi chạy lại."
      exit 1
    fi
  done
fi
echo "  [OK] Docker Engine đã sẵn sàng!"
echo ""

# 2. Khởi động PostgreSQL
echo "[2/4] Khởi động PostgreSQL 18 container..."
docker compose -f infra/compose.yaml up -d postgres
echo "  -> Đang chờ PostgreSQL trên port 5433..."
until node -e 'require("net").createConnection(5433, "127.0.0.1").on("connect", () => process.exit(0)).on("error", () => process.exit(1))' 2>/dev/null; do
  sleep 1
done
echo "  [OK] PostgreSQL đã sẵn sàng trên port 5433!"
echo ""

# 3. Mở trình duyệt 1 tab duy nhất
echo "[3/4] Mở trình duyệt tại http://localhost:5555..."
(
  sleep 3
  if [[ "$OSTYPE" == "darwin"* ]]; then
    open http://localhost:5555
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open http://localhost:5555
  fi
) &

# 4. Chạy Prisma Studio
echo "[4/4] Khởi động Prisma Studio..."
echo "=============================================================================="
echo "[THÀNH CÔNG] Prisma Studio đang chạy tại http://localhost:5555"
echo "  (Nhấn Ctrl + C để dừng Studio)"
echo "=============================================================================="
echo ""

pnpm exec prisma studio --browser none --port 5555
