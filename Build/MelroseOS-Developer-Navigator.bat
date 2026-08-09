@echo off
setlocal EnableExtensions

title MelroseOS Developer Navigator v3.1.0

set "REPO=D:\MelroseOS\GitHub\MelroseOS"
set "SCRIPT=%REPO%\tools\DEVTOOLS\Navigator\MelroseOS-Developer-Navigator.ps1"

cd /d "%REPO%"

if not exist "%SCRIPT%" (
    echo [FAIL] Navigator script not found:
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
