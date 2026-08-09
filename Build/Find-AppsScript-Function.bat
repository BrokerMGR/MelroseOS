@echo off
setlocal EnableExtensions

title MelroseOS Apps Script Function Locator

cd /d D:\MelroseOS\GitHub\MelroseOS

echo.
echo MelroseOS Apps Script Function Locator
echo =======================================
echo.

set "FUNCTION_NAME="

set /p FUNCTION_NAME=Enter the function name: 

if "%FUNCTION_NAME%"=="" (
    echo.
    echo [FAIL] A function name is required.
    echo.
    pause
    exit /b 1
)

echo.
echo Search mode:
echo   1. Exact function declaration
echo   2. Any reference or call
echo.

set "SEARCH_MODE="
set /p SEARCH_MODE=Choose 1 or 2: 

echo.

if "%SEARCH_MODE%"=="1" (
    powershell.exe ^
        -NoProfile ^
        -ExecutionPolicy Bypass ^
        -File "tools\Find-AppsScriptFunction.ps1" ^
        -FunctionName "%FUNCTION_NAME%" ^
        -ExactMatch
) else (
    powershell.exe ^
        -NoProfile ^
        -ExecutionPolicy Bypass ^
        -File "tools\Find-AppsScriptFunction.ps1" ^
        -FunctionName "%FUNCTION_NAME%"
)

set "EXIT_CODE=%ERRORLEVEL%"

echo.
pause

exit /b %EXIT_CODE%