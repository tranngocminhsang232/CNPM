@echo off
setlocal EnableDelayedExpansion
chcp 65001 > nul
title Prisma Studio - Quan tri Co so du lieu

echo ==============================================================================
echo       PRISMA STUDIO - GIAO DIEN QUAN TRI CO SO DU LIEU (POSTGRESQL)
echo ==============================================================================
echo.

cd /d "%~dp0"
set "PATH=%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin;C:\Users\ADMIN\AppData\Local\Programs\DockerDesktop\resources\bin;C:\Program Files\Docker\Docker\resources\bin;%APPDATA%\npm;C:\Users\ADMIN\AppData\Roaming\npm;%ProgramFiles%\nodejs;%PATH%"

:: 1. Kiem tra Docker
echo [1/4] Kiem tra trang thai Docker Engine...
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
echo       3. Chay lai file start-studio.bat.
pause
exit /b 1

:docker_is_ready
echo   [OK] Docker Engine da san sang!
echo.

:: 2. Khoi dong PostgreSQL
echo [2/4] Khoi dong Database PostgreSQL 18 container...
docker compose -f infra/compose.yaml up -d postgres
if %errorlevel% neq 0 (
    echo   [!] Khong the khoi dong container PostgreSQL.
    pause
    exit /b 1
)

:: Cho PostgreSQL san sang ket noi tren port 5433
set pg_wait=0
:wait_pg_loop
powershell -NoProfile -Command "try { $tcp = New-Object System.Net.Sockets.TcpClient('127.0.0.1', 5433); $tcp.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel% equ 0 goto pg_is_ready
ping 127.0.0.1 -n 2 >nul
set /a pg_wait+=1
if !pg_wait! geq 15 goto pg_is_ready
goto wait_pg_loop

:pg_is_ready
echo   [OK] PostgreSQL da san sang tren port 5433!
echo.

:: 3. Khoi dong Prisma Studio
echo [3/4] Khoi dong Prisma Studio tai port 5555...
start "CarSharing - Prisma Studio (Port 5555)" /D "%~dp0" cmd /k "chcp 65001 > nul && title Prisma Studio && pnpm exec prisma studio --browser none --port 5555"

:: 4. Mo trinh duyet 1 tab duy nhat
echo [4/4] Dang mo trinh duyet quan tri CSDL...
ping 127.0.0.1 -n 4 >nul
start http://localhost:5555

echo.
echo ==============================================================================
echo [THANH CONG] Prisma Studio da duoc mo tai http://localhost:5555
echo (Ban co the xem, sua, xoa, them du lieu truc tiep tren trinh duyet nhu phpMyAdmin)
echo ==============================================================================
echo.
pause
