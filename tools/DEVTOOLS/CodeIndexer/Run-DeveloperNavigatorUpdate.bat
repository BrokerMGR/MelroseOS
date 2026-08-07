@echo off
title MelroseOS Developer Navigator Update

cd /d "%~dp0"

powershell -ExecutionPolicy Bypass -File "%~dp0Update-DeveloperNavigator.ps1"

echo.
echo Opening Developer Navigator Index...
echo.

start "" "%~dp0reports\DeveloperNavigatorIndex.json"

pause