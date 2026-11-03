#!/usr/bin/env bash
# ==============================================================================
# KHÔI PHỤC DỮ LIỆU MẪU BAN ĐẦU CHO macOS / Linux
# ==============================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "=============================================================================="
echo "      KHÔI PHỤC DỮ LIỆU MẪU BAN ĐẦU - RESET VÀ SEED DATABASE"
echo "=============================================================================="
echo ""
echo "CẢNH BÁO: Thao tác này sẽ xóa toàn bộ đơn đặt xe thử nghiệm và khôi phục"
echo "          về 4 tài khoản Demo và 13 xe ban đầu."
echo ""
read -r -p "Bạn có chắc chắn muốn khôi phục không? (y/N): " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Đã hủy thao tác."
  exit 0
fi

echo ""
echo "[1/3] Kiểm tra Docker Containers..."
docker compose -f infra/compose.yaml up -d postgres >/dev/null 2>&1

echo "[2/3] Xóa và tạo lại schema CSDL..."
pnpm exec prisma migrate reset --force

echo "[3/3] Nạp lại dữ liệu mẫu ban đầu..."
pnpm db:seed

echo ""
echo "=============================================================================="
echo "[THÀNH CÔNG] Dữ liệu đã được làm mới hoàn toàn về trạng thái ban đầu!"
echo "=============================================================================="
echo ""
