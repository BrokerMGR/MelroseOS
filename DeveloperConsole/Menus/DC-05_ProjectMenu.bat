@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "MENU_DIR=%~dp0"
for %%I in ("%MENU_DIR%..\..") do set "ROOT=%%~fI"
set "CONSOLE=%ROOT%\DeveloperConsole"

:MENU
cls
echo.
echo ==========================================================
echo                  PROJECT TOOLS
echo ==========================================================
echo.
echo   1. Register MelroseOS Projects
echo   2. Preview MelroseOS Projects
echo   3. Open PROJECTS Folder
echo   4. Project Registration Tools
echo.
echo   0. Back
echo.
echo ==========================================================
echo.

set /p "CHOICE=Select Option: "

if "%CHOICE%"=="1" call "%CONSOLE%\Projects\DC-50_ProjectTools.bat" REGISTER
if "%CHOICE%"=="2" call "%CONSOLE%\Projects\DC-50_ProjectTools.bat" PREVIEW
if "%CHOICE%"=="3" call "%CONSOLE%\Projects\DC-50_ProjectTools.bat" OPEN
if "%CHOICE%"=="4" call "%CONSOLE%\Projects\DC-50_ProjectTools.bat" DEVTOOLS
if "%CHOICE%"=="0" exit /b 0

goto MENU
