@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "GIT_DIR=%~dp0"
for %%I in ("%GIT_DIR%..\..") do set "ROOT=%%~fI"

cls
echo.
echo ==========================================================
echo                     GIT PULL
echo ==========================================================
echo.

if not exist "%ROOT%\.git" (
    echo [FAIL] Git repository not found:
    echo %ROOT%
    pause
    exit /b 1
)

cd /d "%ROOT%"
git pull

if errorlevel 1 (
    echo.
    echo [FAIL] Git pull failed.
    pause
    exit /b 1
)

echo.
echo [PASS] Repository is current.
pause
exit /b 0
