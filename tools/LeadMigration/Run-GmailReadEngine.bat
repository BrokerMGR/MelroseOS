@echo off
setlocal EnableExtensions

title MOS5-016 S1H Gmail Read Engine

cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0LM-41_S1HValidator.ps1"
if errorlevel 1 goto :fail

echo.
echo [PASS] MOS5-016-S1H validation complete.
exit /b 0

:fail
echo.
echo [FAIL] MOS5-016-S1H validation failed.
exit /b 1
