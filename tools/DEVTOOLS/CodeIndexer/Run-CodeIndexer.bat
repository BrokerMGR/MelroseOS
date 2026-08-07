@echo off
title MelroseOS Enterprise Code Indexer

cd /d "%~dp0"

powershell -ExecutionPolicy Bypass -File "%~dp0Index-MelroseOS-Code.ps1"

echo.
echo Opening report...
echo.

start "" "%~dp0reports\MelroseOS-CodeIndex.csv"

pause