@echo off
setlocal EnableExtensions

set "ROOT=D:\MelroseOS\GitHub\MelroseOS"
set "CERT=%ROOT%\PackageManager\Certification"

:MENU
cls
echo.
echo ==========================================================
echo        MOS5-018 PACKAGE CERTIFICATION CONSOLE
echo ==========================================================
echo.
echo   1. Run Full Package Certification
echo   2. Open Certification Reports
echo   3. Open Final Certification Report
echo.
echo   0. Exit
echo.
echo ==========================================================
echo.

set /p "CHOICE=Select Option: "

if "%CHOICE%"=="1" call "%CERT%\Run-FullPackageCertification.bat"

if "%CHOICE%"=="2" (
    if not exist "%CERT%\Reports" mkdir "%CERT%\Reports"
    start "" explorer "%CERT%\Reports"
)

if "%CHOICE%"=="3" (
    if exist "%CERT%\Reports\PKGCERT-012-Final.json" (
        start "" notepad "%CERT%\Reports\PKGCERT-012-Final.json"
    ) else (
        echo [FAIL] Final certification report not found.
        pause
    )
)

if "%CHOICE%"=="0" exit /b 0

goto MENU
