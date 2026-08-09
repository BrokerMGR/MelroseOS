@echo off
setlocal EnableExtensions

title MelroseOS Project Registration

set "REPO=D:\MelroseOS\GitHub\MelroseOS"
set "SCRIPT=%REPO%\tools\DEVTOOLS\ProjectRegistration\Register-MelroseOS-Projects.ps1"

cd /d "%REPO%"

if not exist "%SCRIPT%" (
    echo [FAIL] Registration script not found:
    echo %SCRIPT%
    echo.
    pause
    exit /b 1
)

powershell.exe ^
  -NoProfile ^
  -ExecutionPolicy Bypass ^
  -File "%SCRIPT%"

set "EXIT_CODE=%ERRORLEVEL%"
echo.
pause
exit /b %EXIT_CODE%
