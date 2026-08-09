@echo off
setlocal EnableExtensions EnableDelayedExpansion

title MelroseOS Enterprise Module Installer

REM ==========================================================
REM MelroseOS Enterprise
REM Module Installer
REM Version 4.0.0
REM ==========================================================

REM ----------------------------------------------------------
REM LOCATE REPOSITORY
REM ----------------------------------------------------------

set "BUILD_DIR=%~dp0"

for %%I in ("%BUILD_DIR%..") do (
    set "ROOT=%%~fI"
)

set "CONFIG_FILE=%ROOT%\MelroseOS.config"

REM ----------------------------------------------------------
REM VERIFY CONFIGURATION
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
REM LOAD CONFIGURATION
REM ----------------------------------------------------------

for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%CONFIG_FILE%") do (
    set "%%A=%%B"
)

REM ----------------------------------------------------------
REM RESOLVE PATHS
REM ----------------------------------------------------------

set "DEV=%DEVELOPMENT%"

for %%I in ("%ROOT%\%COREMODULES%") do (
    set "CORE=%%~fI"
)

for %%I in ("%ROOT%\%ACTIVE%") do (
    set "TARGET=%%~fI"
)

for %%I in ("%ROOT%\%LOGS%") do (
    set "LOGDIR=%%~fI"
)

REM ----------------------------------------------------------
REM START
REM ----------------------------------------------------------

cls

echo.
echo ==========================================================
echo          MELROSEOS MODULE INSTALLER
echo ==========================================================
echo.

echo Repository:
echo %ROOT%
echo.

echo Development:
echo %DEV%
echo.

echo Core Modules:
echo %CORE%
echo.

echo Active Target:
echo %TARGET%
echo.

REM ----------------------------------------------------------
REM VERIFY / CREATE DIRECTORIES
REM ----------------------------------------------------------

if not exist "%ROOT%\.git" (
    echo [FAIL] Git repository not found.
    pause
    exit /b 1
)

if not exist "%DEV%" (
    echo Creating Development folder...
    mkdir "%DEV%"
)

if not exist "%CORE%" (
    echo Creating CoreModules folder...
    mkdir "%CORE%"
)

if not exist "%TARGET%" (
    echo Creating Active folder...
    mkdir "%TARGET%"
)

if not exist "%LOGDIR%" (
    mkdir "%LOGDIR%"
)

REM ----------------------------------------------------------
REM COUNTERS
REM ----------------------------------------------------------

set /a CORECOUNT=0
set /a DEVCOUNT=0
set /a FAILCOUNT=0
set /a VERIFYCOUNT=0

REM ----------------------------------------------------------
REM INSTALL CORE MODULES
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
REM INSTALL DEVELOPMENT MODULES
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
REM VERIFY INSTALLED MODULES
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
REM WRITE INSTALL LOG
REM ----------------------------------------------------------

set "LOGFILE=%LOGDIR%\ModuleInstaller.log"

(
    echo ==========================================================
    echo MelroseOS Module Installer
    echo ==========================================================
    echo Date        : %DATE%
    echo Time        : %TIME%
    echo Repository  : %ROOT%
    echo Core        : %CORECOUNT%
    echo Development : %DEVCOUNT%
    echo Verified    : %VERIFYCOUNT%
    echo Failed      : %FAILCOUNT%
    echo ==========================================================
) >> "%LOGFILE%"

REM ----------------------------------------------------------
REM SUMMARY
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
    echo.
    pause
    exit /b 1

)

echo [PASS] Module installation successful.
echo.

exit /b 0