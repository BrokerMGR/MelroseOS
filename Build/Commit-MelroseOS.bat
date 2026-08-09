@echo off
setlocal EnableExtensions EnableDelayedExpansion

title MelroseOS Enterprise Commit Engine

REM ==========================================================
REM MelroseOS Enterprise
REM Commit Engine
REM Version 4.0.0
REM ==========================================================

REM ----------------------------------------------------------
REM Locate Repository
REM ----------------------------------------------------------

set "BUILD_DIR=%~dp0"

for %%I in ("%BUILD_DIR%..") do (
    set "ROOT=%%~fI"
)

set "CONFIG_FILE=%ROOT%\MelroseOS.config"

if not exist "%CONFIG_FILE%" (
    echo.
    echo [FAIL] MelroseOS.config not found.
    pause
    exit /b 1
)

for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%CONFIG_FILE%") do (
    set "%%A=%%B"
)

for %%I in ("%ROOT%\%REPORTS%") do (
    set "REPORTS_DIR=%%~fI"
)

if not exist "%REPORTS_DIR%" (
    mkdir "%REPORTS_DIR%"
)

cls

echo.
echo ==========================================================
echo           MELROSEOS COMMIT ENGINE
echo ==========================================================
echo.

REM ----------------------------------------------------------
REM Verify Git Repository
REM ----------------------------------------------------------

if not exist "%ROOT%\.git" (
    echo [FAIL] Git repository not found.
    pause
    exit /b 1
)

cd /d "%ROOT%"

echo Repository:
echo %ROOT%
echo.

REM ----------------------------------------------------------
REM Stage Everything
REM ----------------------------------------------------------

echo ----------------------------------------------------------
echo STAGING CHANGES
echo ----------------------------------------------------------
echo.

git add -A

if errorlevel 1 (
    echo [FAIL] git add failed.
    pause
    exit /b 1
)

REM ----------------------------------------------------------
REM Check for Staged Changes
REM ----------------------------------------------------------

git diff --cached --quiet

if %ERRORLEVEL% EQU 0 (

    echo.
    echo [INFO] No staged changes detected.
    echo.

    echo Checking remote status...

    git fetch origin

    if errorlevel 1 (
        echo [FAIL] git fetch failed.
        pause
        exit /b 1
    )

    git status -sb

    echo.
    echo [PASS] Repository has no new changes to commit.
    echo.

    exit /b 0
)

REM ----------------------------------------------------------
REM Generate Commit Message
REM ----------------------------------------------------------

for /f %%I in (
    'powershell -NoProfile -Command "(Get-Date).ToString('yyyy.MM.dd-HHmmss')"'
) do (
    set "BUILDSTAMP=%%I"
)

set "COMMITMSG=MOS5-016 Enterprise Build %BUILDSTAMP%"

echo.
echo ----------------------------------------------------------
echo COMMITTING
echo ----------------------------------------------------------
echo.

echo Commit Message:
echo %COMMITMSG%
echo.

git commit -m "%COMMITMSG%"

if errorlevel 1 (
    echo.
    echo [FAIL] Git commit failed.
    pause
    exit /b 1
)

REM ----------------------------------------------------------
REM Push
REM ----------------------------------------------------------

echo.
echo ----------------------------------------------------------
echo PUSHING TO GITHUB
echo ----------------------------------------------------------
echo.

git push origin main

if errorlevel 1 (
    echo.
    echo [FAIL] Git push failed.
    pause
    exit /b 1
)

REM ----------------------------------------------------------
REM Verify Push
REM ----------------------------------------------------------

echo.
echo ----------------------------------------------------------
echo VERIFYING REMOTE
echo ----------------------------------------------------------
echo.

git fetch origin

if errorlevel 1 (
    echo [FAIL] Unable to verify remote.
    pause
    exit /b 1
)

for /f %%I in ('git rev-parse HEAD') do (
    set "LOCALHEAD=%%I"
)

for /f %%I in ('git rev-parse origin/main') do (
    set "REMOTEHEAD=%%I"
)

echo Local HEAD :
echo %LOCALHEAD%
echo.

echo Remote HEAD:
echo %REMOTEHEAD%
echo.

if /I not "%LOCALHEAD%"=="%REMOTEHEAD%" (

    echo [FAIL] Local and remote commits do not match.
    pause
    exit /b 1
)

REM ----------------------------------------------------------
REM Write Commit Report
REM ----------------------------------------------------------

(
echo ==========================================================
echo MelroseOS Commit Report
echo ==========================================================
echo Date          : %DATE%
echo Time          : %TIME%
echo Commit Message: %COMMITMSG%
echo Local HEAD    : %LOCALHEAD%
echo Remote HEAD   : %REMOTEHEAD%
echo Repository    : %ROOT%
echo Status        : PASS
echo ==========================================================
) > "%REPORTS_DIR%\LastCommit.txt"

REM ----------------------------------------------------------
REM Final Status
REM ----------------------------------------------------------

echo.
echo ----------------------------------------------------------
echo FINAL GIT STATUS
echo ----------------------------------------------------------
echo.

git status

echo.
echo ==========================================================
echo COMMIT AND PUSH VERIFIED
echo ==========================================================
echo.

echo Commit:
echo %COMMITMSG%
echo.

echo Commit Hash:
echo %LOCALHEAD%
echo.

echo GitHub:
echo VERIFIED
echo.

echo [PASS]

exit /b 0