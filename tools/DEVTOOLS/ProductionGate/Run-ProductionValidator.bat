@echo off
title MelroseOS Production Validator

cd /d "%~dp0"

powershell ^
-NoProfile ^
-ExecutionPolicy Bypass ^
-File "%~dp0PG-03_ProductionValidator.ps1"

pause