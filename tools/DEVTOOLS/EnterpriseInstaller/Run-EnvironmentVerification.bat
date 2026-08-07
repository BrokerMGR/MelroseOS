@echo off
title MelroseOS Environment Verification

cd /d "%~dp0"

powershell ^
-NoProfile ^
-ExecutionPolicy Bypass ^
-File "%~dp0INSTALLER-05_EnvironmentVerification.ps1"

pause