@echo off
title MelroseOS Trigger Manager Full Suite

cd /d "%~dp0"

powershell ^
-NoProfile ^
-ExecutionPolicy Bypass ^
-File "%~dp0TRIGGER-09_Bootstrap.ps1"

pause