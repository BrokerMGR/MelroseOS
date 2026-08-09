@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "MENU_DIR=%~dp0"
for %%I in ("%MENU_DIR%..\..") do set "ROOT=%%~fI"
set "CONSOLE=%ROOT%\DeveloperConsole"

:MENU
cls
echo.
echo ==========================================================
echo              MELROSEOS DEVELOPER CONSOLE
echo ==========================================================
echo.
echo   1. Build MelroseOS
echo   2. Install Modules
echo   3. Validation Suite
echo   4. Lead Migration
echo   5. Git Tools
echo   6. Project Tools
echo   7. Apps Script Tools
echo   8. Diagnostics
echo   9. Open Repository
echo  10. Open Development
echo.
echo   0. Exit
echo.
echo ==========================================================
echo.

set /p "CHOICE=Select Option: "

if "%CHOICE%"=="1" call "%CONSOLE%\Actions\DC-10_BuildMelroseOS.bat"
if "%CHOICE%"=="2" call "%CONSOLE%\Actions\DC-11_InstallModules.bat"
if "%CHOICE%"=="3" call "%CONSOLE%\Menus\DC-03_ValidationMenu.bat"
if "%CHOICE%"=="4" call "%CONSOLE%\Menus\DC-02_LeadMigrationMenu.bat"
if "%CHOICE%"=="5" call "%CONSOLE%\Menus\DC-04_GitMenu.bat"
if "%CHOICE%"=="6" call "%CONSOLE%\Menus\DC-05_ProjectMenu.bat"
if "%CHOICE%"=="7" call "%CONSOLE%\AppsScript\DC-60_AppsScriptTools.bat"
if "%CHOICE%"=="8" call "%CONSOLE%\Diagnostics\DC-70_Diagnostics.bat"
if "%CHOICE%"=="9" call "%CONSOLE%\Actions\DC-13_OpenRepository.bat"
if "%CHOICE%"=="10" call "%CONSOLE%\Actions\DC-14_OpenDevelopment.bat"
if "%CHOICE%"=="0" exit /b 0

goto MENU
