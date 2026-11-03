@echo off
chcp 65001 > nul
title Prisma Studio - Quan tri Co so du lieu

echo ==============================================================================
echo       PRISMA STUDIO - GIAO DIEN QUAN TRI CO SO DU LIEU (POSTGRESQL)
echo ==============================================================================
echo.

cd /d "%~dp0"
set "PATH=%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin;C:\Users\ADMIN\AppData\Local\Programs\DockerDesktop\resources\bin;C:\Program Files\Docker\Docker\resources\bin;%APPDATA%\npm;C:\Users\ADMIN\AppData\Roaming\npm;%ProgramFiles%\nodejs;%PATH%"

echo [1/3] Kiem tra Docker Containers...
docker compose -f infra/compose.yaml up -d postgres >nul 2>&1
echo   [OK] PostgreSQL container dang chay tren port 5433.

echo.
echo [2/3] Khoi dong Prisma Studio...
start "CarSharing - Prisma Studio (Port 5555)" /D "%~dp0" cmd /k "chcp 65001 > nul && title Prisma Studio && pnpm exec prisma studio"

echo.
echo [3/3] Cho server san sang va mo trinh duyet...
ping 127.0.0.1 -n 5 >nul
start http://localhost:5555

echo.
echo ==============================================================================
echo [THANH CONG] Prisma Studio da duoc mo tai http://localhost:5555
echo (Ban co the xem, sua, xoa, them du lieu truc tiep tren trinh duyet nhu phpMyAdmin)
echo ==============================================================================
echo.
pause
