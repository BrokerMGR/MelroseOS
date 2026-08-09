@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "MENU_DIR=%~dp0"
for %%I in ("%MENU_DIR%..\..") do set "ROOT=%%~fI"
set "CONSOLE=%ROOT%\DeveloperConsole"

:MENU
cls
echo.
echo ==========================================================
echo                    GIT CONSOLE
echo ==========================================================
echo.
echo   1. Git Status
echo   2. Latest Commit
echo   3. Commit and Push
echo   4. Pull
echo.
echo   0. Back
echo.
echo ==========================================================
echo.

set /p "CHOICE=Select Option: "

if "%CHOICE%"=="1" call "%CONSOLE%\Git\DC-40_GitStatus.bat"
if "%CHOICE%"=="2" call "%CONSOLE%\Git\DC-41_GitLatestCommit.bat"
if "%CHOICE%"=="3" call "%ROOT%\Build\Commit-MelroseOS.bat"
if "%CHOICE%"=="4" (
  cd /d "%ROOT%"
  git pull
  pause
)
if "%CHOICE%"=="0" exit /b 0

goto MENU
