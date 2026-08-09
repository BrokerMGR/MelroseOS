@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ACTION_DIR=%~dp0"
for %%I in ("%ACTION_DIR%..\..") do set "ROOT=%%~fI"
set "INSTALL=%ROOT%\Build\Install-Module.bat"

cls
echo.
echo ==========================================================
echo              INSTALL MODULES
echo ==========================================================
echo.

if not exist "%INSTALL%" (
    echo [FAIL] Install-Module.bat not found:
    echo %INSTALL%
    pause
    exit /b 1
)

call "%INSTALL%"

if errorlevel 1 (
    echo.
    echo [FAIL] Module installation failed.
    pause
    exit /b 1
)

echo.
echo [PASS] Module installation completed.
pause
exit /b 0
