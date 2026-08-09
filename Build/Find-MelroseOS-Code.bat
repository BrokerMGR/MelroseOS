@echo off
setlocal EnableExtensions

title MelroseOS Universal Code Locator

set "REPO=D:\MelroseOS\GitHub\MelroseOS"
set "SCRIPT=%REPO%\tools\DEVTOOLS\Locator\Find-MelroseOS-Code.ps1"

cd /d "%REPO%"

if not exist "%SCRIPT%" (
    echo [FAIL] Locator script not found:
    echo %SCRIPT%
    echo.
    pause
    exit /b 1
)

echo.
echo MelroseOS Universal Code Locator
echo =================================
echo.
set "SEARCH_TERM="
set /p SEARCH_TERM=Enter function, file, constant, sheet, or text to locate: 

if "%SEARCH_TERM%"=="" (
    echo.
    echo [FAIL] A search term is required.
    echo.
    pause
    exit /b 1
)

echo.
echo Search mode:
echo   1. Exact function declaration
echo   2. Any reference or text
echo   3. File name
echo.
set "MODE="
set /p MODE=Choose 1, 2, or 3: 

if "%MODE%"=="1" (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" -SearchTerm "%SEARCH_TERM%" -Mode Function
) else if "%MODE%"=="3" (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" -SearchTerm "%SEARCH_TERM%" -Mode File
) else (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" -SearchTerm "%SEARCH_TERM%" -Mode Text
)

set "EXIT_CODE=%ERRORLEVEL%"
echo.
pause
exit /b %EXIT_CODE%
