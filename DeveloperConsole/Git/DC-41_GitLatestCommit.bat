@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "GIT_DIR=%~dp0"
for %%I in ("%GIT_DIR%..\..") do set "ROOT=%%~fI"

cls
echo.
echo ==========================================================
echo                  LATEST GIT COMMIT
echo ==========================================================
echo.

if not exist "%ROOT%\.git" (
    echo [FAIL] Git repository not found:
    echo %ROOT%
    pause
    exit /b 1
)

cd /d "%ROOT%"

git log --oneline -5

echo.
echo ----------------------------------------------------------
echo LOCAL HEAD
echo ----------------------------------------------------------
git rev-parse HEAD

echo.
echo ----------------------------------------------------------
echo REMOTE HEAD
echo ----------------------------------------------------------
git rev-parse origin/main

echo.
pause
exit /b 0
