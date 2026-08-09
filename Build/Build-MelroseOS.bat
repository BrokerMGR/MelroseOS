@echo off
setlocal EnableExtensions EnableDelayedExpansion

title MelroseOS Enterprise Build Engine

REM ==========================================================
REM MelroseOS Enterprise
REM Build Engine
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
echo              MELROSEOS BUILD ENGINE
echo ==========================================================
echo.

echo Repository:
echo %ROOT%
echo.

REM ----------------------------------------------------------
REM Verify Git Repository
REM ----------------------------------------------------------

if not exist "%ROOT%\.git" (
    echo [FAIL] Git repository not found.
    pause
    exit /b 1
)

REM ----------------------------------------------------------
REM STEP 1 - Install Modules
REM ----------------------------------------------------------

echo.
echo ==========================================================
echo STEP 1 OF 4
echo INSTALL MODULES
echo ==========================================================
echo.

call "%BUILD_DIR%Install-Module.bat"

if errorlevel 1 goto FAILED

REM ----------------------------------------------------------
REM STEP 2 - Validate
REM ----------------------------------------------------------

echo.
echo ==========================================================
echo STEP 2 OF 4
echo VALIDATE PROJECT
echo ==========================================================
echo.

call "%BUILD_DIR%Validate-MelroseOS.bat"

if errorlevel 1 goto FAILED

REM ----------------------------------------------------------
REM STEP 3 - Write Build Report
REM ----------------------------------------------------------

echo.
echo ==========================================================
echo STEP 3 OF 4
echo GENERATE BUILD REPORT
echo ==========================================================
echo.

for /f %%I in (
    'powershell -NoProfile -Command "(Get-Date).ToString('yyyy-MM-dd HH:mm:ss')"'
) do (
    set "BUILDTIME=%%I"
)

(
echo ==========================================================
echo MelroseOS Build Report
echo ==========================================================
echo Date       : %DATE%
echo Time       : %TIME%
echo Build Time : %BUILDTIME%
echo User       : %USERNAME%
echo Computer   : %COMPUTERNAME%
echo Repository : %ROOT%
echo Status     : PRE-COMMIT PASS
echo ==========================================================
) > "%REPORTS_DIR%\BuildReport.txt"

echo [PASS] Build report created.
echo.

REM ----------------------------------------------------------
REM STEP 4 - Commit and Push
REM ----------------------------------------------------------

echo.
echo ==========================================================
echo STEP 4 OF 4
echo COMMIT AND PUSH
echo ==========================================================
echo.

call "%BUILD_DIR%Commit-MelroseOS.bat"

if errorlevel 1 goto FAILED

REM ----------------------------------------------------------
REM Final Verification
REM ----------------------------------------------------------

cd /d "%ROOT%"

echo.
echo ----------------------------------------------------------
echo FINAL REPOSITORY STATUS
echo ----------------------------------------------------------
echo.

git status

echo.
echo ----------------------------------------------------------
echo LATEST COMMIT
echo ----------------------------------------------------------
echo.

git log --oneline -1

echo.
echo ==========================================================
echo BUILD COMPLETED SUCCESSFULLY
echo ==========================================================
echo.

echo [PASS] MelroseOS build, commit, and push verified.
echo.

pause
exit /b 0

:FAILED

echo.
echo ==========================================================
echo BUILD FAILED
echo ==========================================================
echo.

echo Review the error above.
echo No PASS was issued.

echo.
pause
exit /b 1