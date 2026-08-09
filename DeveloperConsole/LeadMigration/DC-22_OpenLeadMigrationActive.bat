@echo off
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "ROOT=%%~fI"
set "ACTIVE=%ROOT%\tools\LeadMigration\Active"

if not exist "%ACTIVE%" (
    echo [FAIL] Active module folder not found:
    echo %ACTIVE%
    pause
    exit /b 1
)

start "" explorer "%ACTIVE%"
exit /b 0
