@echo off
setlocal EnableExtensions

title MOS5-016 S1G Lead Extraction Pipeline

cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0LM-31_GmailQueryBuilder.ps1"
if errorlevel 1 goto :fail

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0LM-35_PipelineValidator.ps1"
if errorlevel 1 goto :fail

echo.
echo [PASS] MOS5-016-S1G pipeline validation complete.
exit /b 0

:fail
echo.
echo [FAIL] MOS5-016-S1G pipeline validation failed.
exit /b 1
