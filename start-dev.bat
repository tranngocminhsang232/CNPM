@echo off
setlocal EnableDelayedExpansion
chcp 65001 > nul
title Khoi dong Car Sharing Platform

echo ==============================================================================
echo       CAR SHARING VA KEYLESS RENTAL PLATFORM - TRINH KHOI DONG TU DONG
echo ==============================================================================
echo.

cd /d "%~dp0"

:: Bo sung cac duong dan thiet yeu vao PATH de luon tim thay docker va pnpm
set "PATH=%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin;C:\Users\ADMIN\AppData\Local\Programs\DockerDesktop\resources\bin;C:\Program Files\Docker\Docker\resources\bin;%APPDATA%\npm;C:\Users\ADMIN\AppData\Roaming\npm;%ProgramFiles%\nodejs;%PATH%"

:: 1. Kiem tra Docker
echo [1/5] Kiem tra trang thai Docker Engine...
docker info >nul 2>&1
if %errorlevel% equ 0 goto docker_is_ready

echo   -^> Docker Desktop chua chay hoac dang khoi dong.
set "DOCKER_EXE="
if exist "%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe" set "DOCKER_EXE=%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe"
if exist "C:\Users\ADMIN\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe" set "DOCKER_EXE=C:\Users\ADMIN\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe"
if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" set "DOCKER_EXE=C:\Program Files\Docker\Docker\Docker Desktop.exe"

if defined DOCKER_EXE (
    echo   -^> Dang tien hanh khoi dong Docker Desktop: "!DOCKER_EXE!"...
    start "" "!DOCKER_EXE!"
) else (
    echo   [!] Khong tim thay Docker Desktop.exe tu dong. Vui long bat Docker Desktop thu cong!
)

echo   -^> Dang cho Docker Engine khoi dong va ket noi (toi da 120s)...
set docker_wait_count=0

:wait_docker_loop
ping 127.0.0.1 -n 3 >nul
docker info >nul 2>&1
if %errorlevel% equ 0 goto docker_is_ready

set /a docker_wait_count+=1
set /a elapsed=docker_wait_count*2
echo   -^> Dang cho Docker Engine... (!elapsed!s / 120s)

if !docker_wait_count! geq 60 goto docker_timeout
goto wait_docker_loop

:docker_timeout
echo.
echo [!] Docker Desktop chua san sang sau 120 giay.
echo     Huong dan khac phuc:
echo       1. Mo ung dung "Docker Desktop" tu Menu Start tren Windows.
echo       2. Cho bieu tuong ca voi o goc phai man hinh chuyen sang mau xanh (Docker is running).
echo       3. Chay lai file start-dev.bat.
pause
exit /b 1

:docker_is_ready
echo   [OK] Docker Engine da san sang!
echo.

:: 2. Khoi dong PostgreSQL va MinIO S3
echo [2/5] Khoi dong Database PostgreSQL 18 va MinIO S3 Containers...
docker compose -f infra/compose.yaml up -d
if %errorlevel% neq 0 (
    echo   [!] Khong the khoi dong Docker Compose containers.
    pause
    exit /b 1
)
echo   [OK] Containers da duoc khoi dong an toan tren port 5433 va 9000!

:: Cho PostgreSQL san sang ket noi tren port 5433
set pg_wait=0
:wait_pg_loop
powershell -NoProfile -Command "try { $tcp = New-Object System.Net.Sockets.TcpClient('127.0.0.1', 5433); $tcp.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel% equ 0 goto pg_is_ready
ping 127.0.0.1 -n 2 >nul
set /a pg_wait+=1
if !pg_wait! geq 60 (
    echo   [!] PostgreSQL chua san sang. Kiem tra Docker logs va chay lai.
    pause
    exit /b 1
)
goto wait_pg_loop

:pg_is_ready
echo.

:: 3. Kiem tra Prisma Migrations
echo [3/5] Dong bo schema co so du lieu...
call pnpm exec prisma migrate deploy
if %errorlevel% neq 0 (
    echo   [!] Khong the chay prisma migrate deploy.
    pause
    exit /b 1
)
echo   [OK] Schema CSDL da san sang!
echo.

:: 4. Khoi dong Backend API va Frontend Web tren 2 cua so doc lap
echo [4/5] Giai phong port cu neu co va khoi dong Backend (Port 4000) ^& Frontend (Port 3000)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetTCPConnection -LocalPort 3000,4000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

start "CarSharing - Backend API (Port 4000)" /D "%~dp0" cmd /k "chcp 65001 > nul && title Backend API - Port 4000 && pnpm --filter @carsharing/api run start:dev"
start "CarSharing - Frontend Web (Port 3000)" /D "%~dp0" cmd /k "chcp 65001 > nul && title Frontend Web - Port 3000 && pnpm --filter @carsharing/web run dev"

:: 5. Cho server san sang va mo trinh duyet
echo [5/5] Dang cho server khoi dong va mo trinh duyet...
node tools/wait-dev-ready.mjs
if %errorlevel% neq 0 (
    echo   [!] Server chua san sang. Kiem tra cua so Backend va Frontend.
    pause
    exit /b 1
)
start http://localhost:3000

echo.
echo ==============================================================================
echo [THANH CONG] Toan bo he thong da duoc khoi dong!
echo.
echo   * Giao dien Web (Frontend) : http://localhost:3000
echo   * Co so du lieu / API      : http://localhost:4000/api/v1
echo   * Tai khoan Demo san co:
echo       - Nguoi thue (Renter)  : renter1@carsharing.local / DemoPassword123!
echo       - Chu xe (Host 1)      : owner1@carsharing.local / DemoPassword123!
echo       - Chu xe (Host 2)      : owner2@carsharing.local / DemoPassword123!
echo.
echo   (Nhan nut dang nhap nhanh tren giao dien Web de vao ngay khong can go pass)
echo.
echo   * De tat he thong: Chay file stop-dev.bat
echo   * De xem CSDL web: Chay file start-studio.bat
echo ==============================================================================
echo.
pause
