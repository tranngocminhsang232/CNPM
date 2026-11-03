@echo off
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

echo.
echo [1/3] Kiem tra Docker Containers...
docker compose -f infra/compose.yaml up -d postgres >nul 2>&1

echo.
echo [2/3] Xoa va tao lai schema CSDL...
call pnpm exec prisma migrate reset --force

echo.
echo [3/3] Nap lai du lieu mau ban dau...
call pnpm db:seed

echo.
echo ==============================================================================
echo [THANH CONG] Du lieu da duoc lam moi hoan toan ve trang thai ban dau!
echo ==============================================================================
echo.
pause
