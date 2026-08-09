@echo off
setlocal EnableExtensions

title MelroseOS - Create INTAKE Project

set "REPO=D:\MelroseOS\GitHub\MelroseOS"
set "PROJECT=%REPO%\PROJECTS\INTAKE"

echo.
echo ==========================================
echo   MelroseOS INTAKE Project Creator
echo ==========================================
echo.

if not exist "%REPO%" (
    echo [FAIL] Repository not found:
    echo %REPO%
    pause
    exit /b 1
)

if not exist "%REPO%\PROJECTS" (
    echo [FAIL] PROJECTS folder not found.
    pause
    exit /b 1
)

echo Creating folders...

mkdir "%PROJECT%" 2>nul
mkdir "%PROJECT%\src" 2>nul
mkdir "%PROJECT%\tests" 2>nul
mkdir "%PROJECT%\assets" 2>nul
mkdir "%PROJECT%\docs" 2>nul
mkdir "%PROJECT%\installers" 2>nul
mkdir "%PROJECT%\diagnostics" 2>nul

echo.>"%PROJECT%\src\.gitkeep"
echo.>"%PROJECT%\tests\.gitkeep"
echo.>"%PROJECT%\assets\.gitkeep"
echo.>"%PROJECT%\docs\.gitkeep"
echo.>"%PROJECT%\installers\.gitkeep"
echo.>"%PROJECT%\diagnostics\.gitkeep"

if not exist "%PROJECT%\README.md" (
(
echo # MOS5-010 Enterprise Intake Intelligence
echo.
echo Enterprise Intake Engine
)> "%PROJECT%\README.md"
)

if not exist "%PROJECT%\.gitignore" (
(
echo node_modules/
echo .clasp.json
echo .DS_Store
)> "%PROJECT%\.gitignore"
)

if not exist "%PROJECT%\.claspignore" (
(
echo tests/**
echo docs/**
echo assets/**
echo diagnostics/**
echo installers/**
)> "%PROJECT%\.claspignore"
)

if not exist "%PROJECT%\appsscript.json" (
(
echo {
echo   "timeZone": "America/Chicago",
echo   "runtimeVersion": "V8",
echo   "exceptionLogging": "STACKDRIVER"
echo }
)> "%PROJECT%\appsscript.json"
)

echo.
echo ==========================
echo        COMPLETE
echo ==========================
echo.
echo Created:
echo   PROJECTS\INTAKE
echo   src
echo   tests
echo   assets
echo   docs
echo   installers
echo   diagnostics
echo.
echo [PASS]

pause