@echo off
setlocal EnableExtensions

set "ROOT=D:\MelroseOS\GitHub\MelroseOS"
set "HEALTH=%ROOT%\DeveloperConsole\Diagnostics\DC-90_StartupHealthCheck.bat"
set "CONSOLE=%ROOT%\DeveloperConsole\Run-DeveloperConsole.bat"

cls
echo.
echo ==========================================================
echo                  MELROSEOS
echo              DEVELOPER ENVIRONMENT
echo ==========================================================
echo.

if not exist "%CONSOLE%" (
    echo [FAIL] Developer Console not found:
    echo %CONSOLE%
    pause
    exit /b 1
)

if exist "%HEALTH%" (
    call "%HEALTH%"
    if errorlevel 1 (
        echo.
        echo [WARN] Startup diagnostics reported an issue.
        echo The Developer Console will still open for repair access.
        echo.
        pause
    )
)

call "%CONSOLE%"
exit /b %errorlevel%
