@echo off
setlocal EnableExtensions EnableDelayedExpansion

title MelroseOS Enterprise Module Installer

REM ==========================================================
REM MelroseOS Enterprise
REM Module Installer
REM Version 5.0.0
REM Release MOS5-016
REM ==========================================================

REM ----------------------------------------------------------
REM Locate Repository
REM ----------------------------------------------------------

set "BUILD_DIR=%~dp0"

for %%I in ("%BUILD_DIR%..") do (
    set "ROOT=%%~fI"
)

set "CONFIG_FILE=%ROOT%\MelroseOS.config"

REM ----------------------------------------------------------
REM Verify Configuration
REM ----------------------------------------------------------

if not exist "%CONFIG_FILE%" (
    echo.
    echo ==========================================================
    echo CONFIGURATION ERROR
    echo ==========================================================
    echo.
    echo [FAIL] MelroseOS.config not found.
    echo.
    echo Expected:
    echo %CONFIG_FILE%
    echo.
    pause
    exit /b 1
)

REM ----------------------------------------------------------
REM Load Configuration
REM ----------------------------------------------------------

for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%CONFIG_FILE%") do (
    set "%%A=%%B"
)

REM ----------------------------------------------------------
REM Resolve Repository Relative Paths
REM ----------------------------------------------------------

for %%I in ("%ROOT%\%DEVELOPMENT%") do (
    set "DEV=%%~fI"
)

for %%I in ("%ROOT%\%COREMODULES%") do (
    set "CORE=%%~fI"
)

for %%I in ("%ROOT%\%ACTIVE%") do (
    set "TARGET=%%~fI"
)

for %%I in ("%ROOT%\%LOGS%") do (
    set "LOGDIR=%%~fI"
)

for %%I in ("%ROOT%\%REPORTS%") do (
    set "REPORTDIR=%%~fI"
)

REM ----------------------------------------------------------
REM Start
REM ----------------------------------------------------------

cls

echo.
echo ==========================================================
echo          MELROSEOS MODULE INSTALLER
echo ==========================================================
echo.

echo Repository :
echo %ROOT%
echo.

echo Development:
echo %DEV%
echo.

echo Core:
echo %CORE%
echo.

echo Active:
echo %TARGET%
echo.

REM ----------------------------------------------------------
REM Verify Repository
REM ----------------------------------------------------------

if not exist "%ROOT%\.git" (
    echo [FAIL] Git repository not found.
    pause
    exit /b 1
)

REM ----------------------------------------------------------
REM Create Required Directories
REM ----------------------------------------------------------

if not exist "%DEV%" (
    mkdir "%DEV%"
)

if not exist "%CORE%" (
    mkdir "%CORE%"
)

if not exist "%TARGET%" (
    mkdir "%TARGET%"
)

if not exist "%LOGDIR%" (
    mkdir "%LOGDIR%"
)

if not exist "%REPORTDIR%" (
    mkdir "%REPORTDIR%"
)

REM ----------------------------------------------------------
REM Counters
REM ----------------------------------------------------------

set /a CORECOUNT=0
set /a DEVCOUNT=0
set /a FAILCOUNT=0
set /a VERIFYCOUNT=0

REM ----------------------------------------------------------
REM Install Core Modules
REM ----------------------------------------------------------

echo.
echo ----------------------------------------------------------
echo INSTALLING CORE MODULES
echo ----------------------------------------------------------
echo.

set "CORE_FOUND=0"

for %%F in ("%CORE%\*.ps1") do (

    if exist "%%~fF" (

        set "CORE_FOUND=1"

        copy /Y "%%~fF" "%TARGET%\%%~nxF" >nul

        if errorlevel 1 (

            echo [FAIL] %%~nxF
            set /a FAILCOUNT+=1

        ) else (

            echo [PASS] %%~nxF
            set /a CORECOUNT+=1

        )

    )

)

if "!CORE_FOUND!"=="0" (
    echo [WARN] No CoreModules found.
)

REM ----------------------------------------------------------
REM Install Development Modules
REM ----------------------------------------------------------

echo.
echo ----------------------------------------------------------
echo INSTALLING DEVELOPMENT MODULES
echo ----------------------------------------------------------
echo.

set "DEV_FOUND=0"

for %%F in ("%DEV%\*.ps1") do (

    if exist "%%~fF" (

        set "DEV_FOUND=1"

        copy /Y "%%~fF" "%TARGET%\%%~nxF" >nul

        if errorlevel 1 (

            echo [FAIL] %%~nxF
            set /a FAILCOUNT+=1

        ) else (

            echo [PASS] %%~nxF
            set /a DEVCOUNT+=1

        )

    )

)

if "!DEV_FOUND!"=="0" (
    echo [WARN] No Development modules found.
)

REM ----------------------------------------------------------
REM Verify Active Modules
REM ----------------------------------------------------------

echo.
echo ----------------------------------------------------------
echo VERIFYING ACTIVE MODULES
echo ----------------------------------------------------------
echo.

for %%F in ("%TARGET%\*.ps1") do (

    if exist "%%~fF" (

        echo [PASS] %%~nxF
        set /a VERIFYCOUNT+=1

    )

)

REM ----------------------------------------------------------
REM Write Install Report
REM ----------------------------------------------------------

set "REPORTFILE=%REPORTDIR%\ModuleInstallReport.txt"

(
echo ==========================================================
echo MelroseOS Module Install Report
echo ==========================================================
echo Date          : %DATE%
echo Time          : %TIME%
echo Repository    : %ROOT%
echo Development   : %DEV%
echo Core          : %CORE%
echo Active        : %TARGET%
echo Core Installed: %CORECOUNT%
echo Dev Installed : %DEVCOUNT%
echo Verified      : %VERIFYCOUNT%
echo Failed        : %FAILCOUNT%
echo ==========================================================
) > "%REPORTFILE%"

REM ----------------------------------------------------------
REM Write Log
REM ----------------------------------------------------------

set "LOGFILE=%LOGDIR%\ModuleInstaller.log"

(
echo %DATE% %TIME% ^| Core=%CORECOUNT% Dev=%DEVCOUNT% Verified=%VERIFYCOUNT% Failed=%FAILCOUNT%
) >> "%LOGFILE%"

REM ----------------------------------------------------------
REM Summary
REM ----------------------------------------------------------

echo.
echo ==========================================================
echo INSTALL SUMMARY
echo ==========================================================
echo.

echo Core Modules Installed : %CORECOUNT%
echo Development Modules    : %DEVCOUNT%
echo Active Modules Verified: %VERIFYCOUNT%
echo Failed Copies          : %FAILCOUNT%

echo.

if %FAILCOUNT% GTR 0 (

    echo [FAIL] Module installation completed with errors.
    pause
    exit /b 1

)

echo [PASS] Module installation successful.
echo.

exit /b 0