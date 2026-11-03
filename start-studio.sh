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

echo "[1/3] Kiểm tra Docker Containers..."
docker compose -f infra/compose.yaml up -d postgres >/dev/null 2>&1
echo "  [OK] PostgreSQL container đang chạy trên port 5433."
echo ""

echo "[2/3] Chờ cơ sở dữ liệu sẵn sàng..."
until node -e 'require("net").createConnection(5433, "127.0.0.1").on("connect", () => process.exit(0)).on("error", () => process.exit(1))' 2>/dev/null; do
  sleep 1
done

(
  sleep 3
  if [[ "$OSTYPE" == "darwin"* ]]; then
    open http://localhost:5555
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open http://localhost:5555
  fi
) &

echo "[3/3] Khởi động Prisma Studio tại http://localhost:5555..."
echo "=============================================================================="
echo "[THÀNH CÔNG] Prisma Studio đang mở tại http://localhost:5555"
echo "=============================================================================="
echo ""

pnpm exec prisma studio
