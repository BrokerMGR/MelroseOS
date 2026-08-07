@echo off
title MelroseOS Function Search

set /p FUNC=Function name: 

cd /d "%~dp0"

powershell -ExecutionPolicy Bypass -File "%~dp0Find-Function.ps1" -Function "%FUNC%"

pause