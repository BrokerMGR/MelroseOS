@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "GIT_DIR=%~dp0"
for %%I in ("%GIT_DIR%..\..") do set "ROOT=%%~fI"
set "COMMIT=%ROOT%\Build\Commit-MelroseOS.bat"

cls
echo.
echo ==========================================================
echo               COMMIT AND PUSH
echo ==========================================================
echo.

if not exist "%COMMIT%" (
    echo [FAIL] Commit-MelroseOS.bat not found:
    echo %COMMIT%
    pause
    exit /b 1
)

call "%COMMIT%"

if errorlevel 1 (
    echo.
    echo [FAIL] Commit or push failed.
    pause
    exit /b 1
)

echo.
echo [PASS] Commit and push completed.
pause
exit /b 0
