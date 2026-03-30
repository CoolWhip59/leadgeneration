@echo off
setlocal EnableExtensions
chcp 65001 >nul

set "ROOT=%~dp0"
cd /d "%ROOT%"
title Isletme Otomatik Baslat

echo ==========================================
echo Isletme otomatik baslatma
echo Klasor: %ROOT%
echo ==========================================
echo.

where npm >nul 2>&1
if errorlevel 1 (
  echo [HATA] npm bulunamadi. Node.js kurulu oldugundan emin ol.
  pause
  exit /b 1
)

if not exist "apps\api\.env" (
  if exist "apps\api\.env.example" (
    copy /Y "apps\api\.env.example" "apps\api\.env" >nul
    echo [OK] apps\api\.env olusturuldu.
  )
)

if not exist "apps\web\.env" (
  if exist "apps\web\.env.example" (
    copy /Y "apps\web\.env.example" "apps\web\.env" >nul
    echo [OK] apps\web\.env olusturuldu.
  )
)

call :run_step "API bagimliliklari" "cd /d ""%ROOT%apps\api"" && npm install --no-audit --no-fund"
if errorlevel 1 (
  echo [UYARI] API install ilk denemede basarisiz oldu. Cache temizleme deneniyor...
  call :run_step "NPM cache verify" "npm cache verify"
  call :run_step "API bagimliliklari (tekrar)" "cd /d ""%ROOT%apps\api"" && npm install --legacy-peer-deps --no-audit --no-fund"
  if errorlevel 1 goto :fail
)

call :run_step "WEB bagimliliklari" "cd /d ""%ROOT%apps\web"" && npm install --no-audit --no-fund"
if errorlevel 1 (
  echo [UYARI] WEB install ilk denemede basarisiz oldu. Cache temizleme deneniyor...
  call :run_step "NPM cache verify" "npm cache verify"
  call :run_step "WEB bagimliliklari (tekrar)" "cd /d ""%ROOT%apps\web"" && npm install --legacy-peer-deps --no-audit --no-fund"
  if errorlevel 1 goto :fail
)

call :unlock_prisma
call :run_step "Prisma generate" "cd /d ""%ROOT%apps\api"" && npm run prisma:generate"
if errorlevel 1 (
  echo [UYARI] Prisma generate kilitli dosyaya takildi. Otomatik kilit temizleme deneniyor...
  call :unlock_prisma
  call :run_step "Prisma generate (tekrar)" "cd /d ""%ROOT%apps\api"" && npm run prisma:generate"
  if errorlevel 1 goto :fail
)

call :run_step "Prisma migrate" "cd /d ""%ROOT%apps\api"" && npm run prisma:migrate"
if errorlevel 1 goto :fail

if /I "%RUN_SEED%"=="1" (
  call :run_step "Prisma seed" "cd /d ""%ROOT%apps\api"" && npm run prisma:seed"
  if errorlevel 1 goto :fail
)

echo.
echo [INFO] Servisler ayri pencerelerde baslatiliyor...

start "Isletme API" cmd /k "cd /d ""%ROOT%apps\api"" && npm run dev"
timeout /t 2 /nobreak >nul
start "Isletme Worker" cmd /k "cd /d ""%ROOT%apps\api"" && npm run worker:dev"
timeout /t 2 /nobreak >nul
start "Isletme Web" cmd /k "cd /d ""%ROOT%apps\web"" && npm run dev"

echo.
echo [OK] API, Worker ve Web baslatildi.
echo [INFO] Web arayuzu: http://localhost:3000
start "" "http://localhost:3000"
exit /b 0

:run_step
set "STEP=%~1"
set "CMD=%~2"
echo.
echo [ADIM] %STEP%
cmd /c "%CMD%"
if errorlevel 1 (
  echo [HATA] %STEP% basarisiz.
  exit /b 1
)
echo [OK] %STEP%
exit /b 0

:unlock_prisma
echo [ADIM] Prisma dosya kilidi temizleniyor...
taskkill /F /IM node.exe /T >nul 2>&1
taskkill /F /IM prisma.exe /T >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq Isletme API*" /T >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq Isletme Worker*" /T >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq Isletme Web*" /T >nul 2>&1
attrib -R "%ROOT%apps\api\node_modules\.prisma\client\query_engine-windows.dll.node" >nul 2>&1
del /F /Q "%ROOT%apps\api\node_modules\.prisma\client\query_engine-windows.dll.node" >nul 2>&1
del /F /Q "%ROOT%apps\api\node_modules\.prisma\client\query_engine-windows.dll.node.tmp*" >nul 2>&1
rd /S /Q "%ROOT%apps\api\node_modules\.prisma" >nul 2>&1
timeout /t 2 /nobreak >nul
echo [OK] Prisma kilit temizleme tamamlandi.
exit /b 0

:fail
echo.
echo Islem durduruldu. Hata surerse tum node sureclerini kapatip bu dosyayi tekrar calistir:
echo   taskkill /F /IM node.exe
echo Sonra tekrar: start_isletme.bat
pause
exit /b 1
