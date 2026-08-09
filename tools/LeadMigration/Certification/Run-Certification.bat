@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=D:\MelroseOS\GitHub\MelroseOS"
set "CERT=%ROOT%\tools\LeadMigration\Certification"

:MENU
cls
echo.
echo ==========================================================
echo          MELROSEOS CERTIFICATION CONSOLE
echo ==========================================================
echo.
echo   1. Quick Certification
echo   2. Full Certification
echo   3. Open Certification Reports
echo.
echo   0. Exit
echo.
echo ==========================================================
echo.

set /p "CHOICE=Select Option: "

if "%CHOICE%"=="1" call "%CERT%\Run-QuickCertification.bat"
if "%CHOICE%"=="2" call "%CERT%\Run-FullCertification.bat"
if "%CHOICE%"=="3" start "" explorer "%CERT%\Reports"
if "%CHOICE%"=="0" exit /b 0

goto MENU
