@echo off
setlocal EnableExtensions EnableDelayedExpansion

title MelroseOS Enterprise Module Generator

REM ==========================================================
REM MelroseOS Enterprise
REM Module Generator
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

REM ----------------------------------------------------------
REM Load Configuration
REM ----------------------------------------------------------

for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%CONFIG_FILE%") do (
    set "%%A=%%B"
)

set "DEV=%DEVELOPMENT%"

if not exist "%DEV%" (
    mkdir "%DEV%"
)

cls

echo.
echo ==========================================================
echo          MELROSEOS MODULE GENERATOR
echo ==========================================================
echo.

echo Example:
echo LM-002_GmailDiscovery
echo LM-003_MessageInventory
echo LM-004_LeadExtraction
echo.

set /P MODULE=Module Name:

if "%MODULE%"=="" (
    echo.
    echo No module entered.
    pause
    exit /b 1
)

set "FILE=%DEV%\%MODULE%.ps1"

if exist "%FILE%" (

    echo.
    echo ==========================================================
    echo MODULE ALREADY EXISTS
    echo ==========================================================
    echo.
    echo %FILE%
    echo.
    pause
    exit /b 1

)

(
echo ^<#
echo ==========================================================
echo MelroseOS Enterprise
echo Module : %MODULE%
echo Version: 1.0.0
echo Release: MOS5-016
echo ==========================================================
echo ^#^>
echo.
echo $ErrorActionPreference = 'Stop'
echo.
echo $RepositoryRoot = Resolve-Path "$PSScriptRoot\.."
echo.
echo $CommonModule = Join-Path $RepositoryRoot "CoreModules\LM-000_Common.ps1"
echo.
echo if ^(-not ^(Test-Path $CommonModule^)^) {
echo     Write-Host "LM-000_Common.ps1 not found." -ForegroundColor Red
echo     exit 1
echo }
echo.
echo . $CommonModule
echo.
echo function Initialize-%MODULE% {
echo.
echo     Write-MOSHeader "%MODULE%"
echo.
echo     Write-MOSInfo "Initializing..."
echo.
echo     Write-MOSSuccess "%MODULE% Loaded"
echo.
echo }
echo.
echo Initialize-%MODULE%
)> "%FILE%"

echo.
echo ==========================================================
echo MODULE CREATED
echo ==========================================================
echo.

echo %FILE%

echo.

choice /M "Open module in Notepad"

if errorlevel 2 goto END

start notepad "%FILE%"

:END

echo.
echo [PASS]

exit /b 0