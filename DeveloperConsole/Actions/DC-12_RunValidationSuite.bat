@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ACTION_DIR=%~dp0"
for %%I in ("%ACTION_DIR%..\..") do set "ROOT=%%~fI"
set "RUNNER=%ROOT%\DeveloperConsole\Validation\DC-30_RunAllValidation.bat"
set "SUITE=%ROOT%\tools\LeadMigration\ValidationSuite"

cls
echo.
echo ==========================================================
echo              VALIDATION SUITE
echo ==========================================================
echo.

if exist "%RUNNER%" (
    call "%RUNNER%"
    exit /b %errorlevel%
)

if not exist "%SUITE%" (
    echo [FAIL] Validation Suite not found:
    echo %SUITE%
    pause
    exit /b 1
)

echo [INFO] Validation runner is not installed yet.
echo [INFO] Validation Suite folder exists and is ready.
echo.
echo %SUITE%
echo.
pause
exit /b 0
