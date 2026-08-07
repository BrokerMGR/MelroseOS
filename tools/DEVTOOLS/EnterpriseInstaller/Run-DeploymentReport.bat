@echo off
title MelroseOS Enterprise Deployment Report

cd /d "%~dp0"

powershell ^
-NoProfile ^
-ExecutionPolicy Bypass ^
-File "%~dp0INSTALLER-06_DeploymentReport.ps1"

pause