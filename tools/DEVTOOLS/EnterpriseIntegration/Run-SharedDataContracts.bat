@echo off
title MelroseOS Shared Data Contracts

cd /d "%~dp0"

powershell ^
-NoProfile ^
-ExecutionPolicy Bypass ^
-File "%~dp0INT-03_SharedDataContracts.ps1"

pause