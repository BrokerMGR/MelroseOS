@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ACTION_DIR=%~dp0"
for %%I in ("%ACTION_DIR%..\..") do set "ROOT=%%~fI"
set "BUILD=%ROOT%\Build\Build-MelroseOS.bat"

cls
echo.
echo ==========================================================
echo              BUILD MELROSEOS
echo ==========================================================
echo.

if not exist "%BUILD%" (
    echo [FAIL] Build-MelroseOS.bat not found:
    echo %BUILD%
    pause
    exit /b 1
)

call "%BUILD%"

if errorlevel 1 (
    echo.
    echo [FAIL] MelroseOS build failed.
    pause
    exit /b 1
)

echo.
echo [PASS] MelroseOS build completed.
pause
exit /b 0
