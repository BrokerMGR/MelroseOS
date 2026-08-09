@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "ROOT=%%~fI"

:MENU
cls
echo.
echo ==========================================================
echo                APPS SCRIPT TOOLS
echo ==========================================================
echo.
echo   1. Find Apps Script Function
echo   2. Find MelroseOS Code
echo   3. Open PROJECTS Folder
echo   4. Register Projects
echo   5. Preview Projects
echo.
echo   0. Back
echo.
echo ==========================================================
echo.

set /p "CHOICE=Select Option: "

if "%CHOICE%"=="1" goto FIND_FUNCTION
if "%CHOICE%"=="2" goto FIND_CODE
if "%CHOICE%"=="3" goto OPEN_PROJECTS
if "%CHOICE%"=="4" goto REGISTER
if "%CHOICE%"=="5" goto PREVIEW
if "%CHOICE%"=="0" exit /b 0

goto MENU

:FIND_FUNCTION
set "TOOL=%ROOT%\Build\Find-AppsScript-Function.bat"
if not exist "%TOOL%" set "TOOL=%ROOT%\Find-AppsScript-Function.bat"
if not exist "%TOOL%" (
    echo [FAIL] Find-AppsScript-Function.bat not found.
    pause
    goto MENU
)
call "%TOOL%"
pause
goto MENU

:FIND_CODE
set "TOOL=%ROOT%\Build\Find-MelroseOS-Code.bat"
if not exist "%TOOL%" set "TOOL=%ROOT%\Find-MelroseOS-Code.bat"
if not exist "%TOOL%" (
    echo [FAIL] Find-MelroseOS-Code.bat not found.
    pause
    goto MENU
)
call "%TOOL%"
pause
goto MENU

:OPEN_PROJECTS
if not exist "%ROOT%\PROJECTS" mkdir "%ROOT%\PROJECTS"
start "" explorer "%ROOT%\PROJECTS"
goto MENU

:REGISTER
set "TOOL=%ROOT%\Build\Register-MelroseOS-Projects.bat"
if not exist "%TOOL%" set "TOOL=%ROOT%\Register-MelroseOS-Projects.bat"
if not exist "%TOOL%" (
    echo [FAIL] Register-MelroseOS-Projects.bat not found.
    pause
    goto MENU
)
call "%TOOL%"
pause
goto MENU

:PREVIEW
set "TOOL=%ROOT%\Build\Preview-MelroseOS-Projects.bat"
if not exist "%TOOL%" set "TOOL=%ROOT%\Preview-MelroseOS-Projects.bat"
if not exist "%TOOL%" (
    echo [FAIL] Preview-MelroseOS-Projects.bat not found.
    pause
    goto MENU
)
call "%TOOL%"
pause
goto MENU
