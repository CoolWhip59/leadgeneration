@echo off
setlocal EnableExtensions
chcp 65001 >nul

set "ROOT=%~dp0"
cd /d "%ROOT%"
title Prisma Lock Fix

echo ==========================================
echo Prisma kilit hatasi otomatik fix
echo ==========================================
echo.

echo [1/5] Node/Prisma surecleri kapatiliyor...
taskkill /F /IM node.exe /T >nul 2>&1
taskkill /F /IM prisma.exe /T >nul 2>&1

echo [2/5] Kilitli engine dosyalari temizleniyor...
attrib -R "%ROOT%apps\api\node_modules\.prisma\client\query_engine-windows.dll.node" >nul 2>&1
del /F /Q "%ROOT%apps\api\node_modules\.prisma\client\query_engine-windows.dll.node" >nul 2>&1
del /F /Q "%ROOT%apps\api\node_modules\.prisma\client\query_engine-windows.dll.node.tmp*" >nul 2>&1
rd /S /Q "%ROOT%apps\api\node_modules\.prisma" >nul 2>&1

echo [3/5] API bagimliliklari yenileniyor...
cd /d "%ROOT%apps\api"
call npm install --no-audit --no-fund
if errorlevel 1 goto :fail

echo [4/5] Prisma generate...
call npm run prisma:generate
if errorlevel 1 goto :fail

echo [5/5] Prisma migrate...
call npm run prisma:migrate
if errorlevel 1 goto :fail

echo.
echo [OK] Prisma kilit sorunu giderildi.
echo Simdi start_isletme.bat ile tum sistemi acabilirsin.
pause
exit /b 0

:fail
echo.
echo [HATA] Fix tamamlanamadi.
echo Lutfen bu dosyayi "Run as administrator" ile bir kez calistir.
pause
exit /b 1
