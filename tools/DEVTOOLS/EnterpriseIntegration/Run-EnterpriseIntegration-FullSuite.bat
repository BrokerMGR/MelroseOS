@echo off
title MelroseOS Enterprise Integration Full Suite

cd /d "%~dp0"

powershell ^
-NoProfile ^
-ExecutionPolicy Bypass ^
-File "%~dp0INT-09_EnterpriseBootstrap.ps1"

pause