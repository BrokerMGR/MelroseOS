@echo off
setlocal EnableExtensions
set "ACTIVE=D:\MelroseOS\GitHub\MelroseOS\tools\LeadMigration\Active"
if not exist "%ACTIVE%" (
    echo [FAIL] Active module folder not found:
    echo %ACTIVE%
    pause
    exit /b 1
)
start "" explorer "%ACTIVE%"
exit /b 0
