@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "GIT_DIR=%~dp0"
for %%I in ("%GIT_DIR%..\..") do set "ROOT=%%~fI"

cls
echo.
echo ==========================================================
echo                 VERIFY GIT SYNC
echo ==========================================================
echo.

if not exist "%ROOT%\.git" (
    echo [FAIL] Git repository not found:
    echo %ROOT%
    pause
    exit /b 1
)

cd /d "%ROOT%"

git fetch origin
if errorlevel 1 (
    echo [FAIL] git fetch failed.
    pause
    exit /b 1
)

for /f %%I in ('git rev-parse HEAD') do set "LOCALHEAD=%%I"
for /f %%I in ('git rev-parse origin/main') do set "REMOTEHEAD=%%I"

echo Local :
echo %LOCALHEAD%
echo.
echo Remote:
echo %REMOTEHEAD%
echo.

if /I "%LOCALHEAD%"=="%REMOTEHEAD%" (
    echo [PASS] Local and GitHub are synchronized.
    pause
    exit /b 0
)

echo [FAIL] Local and GitHub do not match.
pause
exit /b 1
