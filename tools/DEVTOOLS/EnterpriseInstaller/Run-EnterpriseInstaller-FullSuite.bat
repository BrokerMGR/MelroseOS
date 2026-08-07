@echo off
title MelroseOS Enterprise Installer Full Suite

cd /d "%~dp0"

powershell ^
-NoProfile ^
-ExecutionPolicy Bypass ^
-File "%~dp0INSTALLER-07_Bootstrap.ps1"

pause