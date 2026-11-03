#!/usr/bin/env bash
# ==============================================================================
# CAR SHARING & KEYLESS RENTAL PLATFORM - TRÌNH DỪNG HỆ THỐNG (macOS / Linux)
# ==============================================================================

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "=============================================================================="
echo "      CAR SHARING VÀ KEYLESS RENTAL PLATFORM - TRÌNH DỪNG HỆ THỐNG"
echo "=============================================================================="
echo ""

echo "[1/2] Dừng các tiến trình Node.js trên cổng 3000 và 4000..."
if command -v lsof >/dev/null 2>&1; then
  lsof -ti:3000,4000 | xargs kill -9 2>/dev/null || true
elif command -v fuser >/dev/null 2>&1; then
  fuser -k 3000/tcp 4000/tcp 2>/dev/null || true
fi
echo "  [OK] Các server Backend và Frontend đã được dừng!"
echo ""

echo "[2/2] Tạm dừng Docker Containers..."
docker compose -f infra/compose.yaml stop >/dev/null 2>&1 || true
echo "  [OK] Containers đã tạm dừng an toàn."
echo ""

echo "=============================================================================="
echo "[THÀNH CÔNG] Hệ thống đã được dừng sạch sẽ."
echo "=============================================================================="
echo ""

