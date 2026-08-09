@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "ROOT=%%~fI"
set "CERT=%ROOT%\tools\LeadMigration\Certification"

:MENU
cls
echo.
echo ==========================================================
echo               CERTIFICATION FRAMEWORK
echo ==========================================================
echo.
echo   1. Certification Console
echo   2. Quick Certification
echo   3. Full Certification
echo   4. Open Certification Reports
echo   5. Open Final Certification Report
echo.
echo   0. Back
echo.
echo ==========================================================
echo.

set /p "CHOICE=Select Option: "

if "%CHOICE%"=="1" (
    if exist "%CERT%\Run-Certification.bat" (
        call "%CERT%\Run-Certification.bat"
    ) else (
        echo [FAIL] Certification console not found.
        pause
    )
)

if "%CHOICE%"=="2" (
    if exist "%CERT%\Run-QuickCertification.bat" (
        call "%CERT%\Run-QuickCertification.bat"
    ) else (
        echo [FAIL] Quick certification runner not found.
        pause
    )
)

if "%CHOICE%"=="3" (
    if exist "%CERT%\Run-FullCertification.bat" (
        call "%CERT%\Run-FullCertification.bat"
    ) else (
        echo [FAIL] Full certification runner not found.
        pause
    )
)

if "%CHOICE%"=="4" (
    if not exist "%CERT%\Reports" mkdir "%CERT%\Reports"
    start "" explorer "%CERT%\Reports"
)

if "%CHOICE%"=="5" (
    if exist "%CERT%\Reports\CERT-015-Final.json" (
        start "" notepad "%CERT%\Reports\CERT-015-Final.json"
    ) else (
        echo [FAIL] CERT-015-Final.json not found.
        pause
    )
)

if "%CHOICE%"=="0" exit /b 0

goto MENU
