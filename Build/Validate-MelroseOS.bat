@echo off
setlocal EnableExtensions EnableDelayedExpansion

title MelroseOS Enterprise Validator

REM ==========================================================
REM MelroseOS Enterprise
REM Validation Engine
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

REM ----------------------------------------------------------
REM Resolve Paths
REM ----------------------------------------------------------

for %%I in ("%ROOT%\%ACTIVE%") do set "ACTIVE_DIR=%%~fI"
for %%I in ("%ROOT%\%CONFIG%") do set "CONFIG_DIR=%%~fI"
for %%I in ("%ROOT%\%REPORTS%") do set "REPORTS_DIR=%%~fI"
for %%I in ("%ROOT%\%LOGS%") do set "LOGS_DIR=%%~fI"
for %%I in ("%ROOT%\%TESTS%") do set "TESTS_DIR=%%~fI"
for %%I in ("%ROOT%\%INSTALLERS%") do set "INSTALLERS_DIR=%%~fI"

cls

echo.
echo ==========================================================
echo          MELROSEOS VALIDATION ENGINE
echo ==========================================================
echo.

set PASSCOUNT=0
set FAILCOUNT=0

call :CheckFolder "%ACTIVE_DIR%" "Active"
call :CheckFolder "%CONFIG_DIR%" "Config"
call :CheckFolder "%REPORTS_DIR%" "Reports"
call :CheckFolder "%LOGS_DIR%" "Logs"
call :CheckFolder "%TESTS_DIR%" "Tests"
call :CheckFolder "%INSTALLERS_DIR%" "Installers"

echo.
echo ----------------------------------------------------------
echo VALIDATING MODULES
echo ----------------------------------------------------------
echo.

set MODULECOUNT=0

for %%F in ("%ACTIVE_DIR%\*.ps1") do (
    if exist "%%~fF" (
        echo [PASS] %%~nxF
        set /a MODULECOUNT+=1
    )
)

if %MODULECOUNT% EQU 0 (
    echo [FAIL] No modules found.
    set /a FAILCOUNT+=1
)

echo.
echo ----------------------------------------------------------
echo WRITING REPORT
echo ----------------------------------------------------------
echo.

(
echo ==========================================================
echo MelroseOS Validation Report
echo ==========================================================
echo Date      : %DATE%
echo Time      : %TIME%
echo Modules   : %MODULECOUNT%
echo Passed    : %PASSCOUNT%
echo Failed    : %FAILCOUNT%
echo ==========================================================
)> "%REPORTS_DIR%\ValidationReport.txt"

echo.
echo ==========================================================
echo VALIDATION SUMMARY
echo ==========================================================
echo.

echo Modules : %MODULECOUNT%
echo Passed  : %PASSCOUNT%
echo Failed  : %FAILCOUNT%

echo.

if %FAILCOUNT% GTR 0 (

    echo [FAIL]
    pause
    exit /b 1

)

echo [PASS]
exit /b 0

:CheckFolder

if exist %1 (

    echo [PASS] %2
    set /a PASSCOUNT+=1

) else (

    echo [FAIL] %2
    set /a FAILCOUNT+=1

)

exit /b