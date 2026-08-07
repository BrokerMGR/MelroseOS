@echo off

cd /d "%~dp0"

powershell ^
-NoProfile ^
-ExecutionPolicy Bypass ^
-File "%~dp0TRIGGER-04_MissingTriggerDetector.ps1"

pause