@echo off

cd /d "%~dp0"

powershell ^
-NoProfile ^
-ExecutionPolicy Bypass ^
-File "%~dp0TRIGGER-02_HealthCheck.ps1"

pause