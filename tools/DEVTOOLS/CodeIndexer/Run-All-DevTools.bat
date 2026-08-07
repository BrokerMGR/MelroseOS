@echo off
title MelroseOS Enterprise DEVTOOLS

cd /d "%~dp0"

echo.
echo ===============================
echo   MELROSEOS DEVTOOLS SUITE
echo ===============================
echo.

call Run-CodeIndexer.bat

powershell -ExecutionPolicy Bypass -File "%~dp0Update-DeveloperNavigator.ps1"

echo.
echo DEVTOOLS COMPLETE.
echo.

pause