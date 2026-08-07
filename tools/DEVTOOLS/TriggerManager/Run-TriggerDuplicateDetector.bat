@echo off
cd /d "%~dp0"

powershell ^
-NoProfile ^
-ExecutionPolicy Bypass ^
-File "%~dp0TRIGGER-03_DuplicateDetector.ps1"

pause