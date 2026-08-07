@echo off
title MelroseOS Configuration Validator

cd /d "%~dp0"

powershell ^
-NoProfile ^
-ExecutionPolicy Bypass ^
-File "%~dp0INT-02_ConfigurationValidator.ps1"

pause