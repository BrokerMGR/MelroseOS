@echo off
title MelroseOS Deployment Validator

cd /d "%~dp0"

powershell ^
-NoProfile ^
-ExecutionPolicy Bypass ^
-File "%~dp0INSTALLER-02_DeploymentValidator.ps1"

pause