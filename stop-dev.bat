@echo off
chcp 65001 > nul
title Dung Car Sharing Platform

echo ==============================================================================
echo       CAR SHARING VA KEYLESS RENTAL PLATFORM - TRINH DUNG HE THONG
echo ==============================================================================
echo.

cd /d "%~dp0"

echo [1/2] Dang dong cac tien trinh Node.js tren cong 3000 va 4000...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetTCPConnection -LocalPort 3000,4000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
echo   [OK] Cac server Backend va Frontend da duoc dung!

echo.
echo [2/2] Dang tam dung Docker Containers...
docker compose -f infra/compose.yaml stop >nul 2>&1
echo   [OK] Containers da tam dung an toan.

echo.
echo ==============================================================================
echo [THANH CONG] He thong da duoc dung sach se.
echo ==============================================================================
echo.
pause
