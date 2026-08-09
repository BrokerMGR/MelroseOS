@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0LM-47_S1IValidator.ps1"
if errorlevel 1 exit /b 1
echo [PASS] MOS5-016-S1I validation complete.
