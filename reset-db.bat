@echo off
setlocal EnableDelayedExpansion
chcp 65001 > nul
title Reset va Nap lai Du lieu Mau Demo

echo ==============================================================================
echo       KHOI PHUC DU LIEU MAU BAN DAU - RESET VA SEED DATABASE
echo ==============================================================================
echo.
echo CANH BAO: Thao tac nay se xoa toan bo don dat xe thu nghiem va khoi phuc
echo          ve 4 tai khoan Demo va 13 xe goc.
echo.
set /p confirm="Ban co chac chan muon khoi phuc khong? (Y/N): "
if /i not "%confirm%"=="Y" (
    echo Da huy thao tac.
    pause
    exit /b 0
)

cd /d "%~dp0"
set "PATH=%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin;C:\Users\ADMIN\AppData\Local\Programs\DockerDesktop\resources\bin;C:\Program Files\Docker\Docker\resources\bin;%APPDATA%\npm;C:\Users\ADMIN\AppData\Roaming\npm;%ProgramFiles%\nodejs;%PATH%"

:: 1. Kiem tra Docker
echo.
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
echo     Vui long mo ung dung Docker Desktop tren Windows roi thu lai.
pause
exit /b 1

:docker_is_ready
echo   [OK] Docker Engine da san sang!

:: 2. Khoi dong PostgreSQL container
echo.
echo [2/4] Kiem tra PostgreSQL Container...
docker compose -f infra/compose.yaml up -d postgres >nul 2>&1

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

:: 3. Xoa va tao lai schema CSDL
echo.
echo [3/4] Xoa va tao lai schema CSDL...
call pnpm exec prisma migrate reset --force

:: 4. Nap lai du lieu mau ban dau
echo.
echo [4/4] Nap lai du lieu mau ban dau...
call pnpm db:seed

echo.
echo ==============================================================================
echo [THANH CONG] Du lieu da duoc lam moi hoan toan ve trang thai ban dau!
echo ==============================================================================
echo.
pause
