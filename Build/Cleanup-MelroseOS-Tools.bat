@echo off
setlocal EnableExtensions

title MelroseOS Safe Cleanup

set "REPO=D:\MelroseOS\GitHub\MelroseOS"
set "SCRIPT=%REPO%\tools\DEVTOOLS\ProjectRegistration\Cleanup-MelroseOS-Tools.ps1"
set "MODE=%~1"

if "%MODE%"=="" set "MODE=interactive"

cd /d "%REPO%"

if not exist "%SCRIPT%" (
    echo [FAIL] Cleanup script not found:
    echo %SCRIPT%
    echo.
    pause
    exit /b 1
)

if /I "%MODE%"=="preview" (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" -PreviewOnly
    exit /b %ERRORLEVEL%
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%"

echo.
pause
