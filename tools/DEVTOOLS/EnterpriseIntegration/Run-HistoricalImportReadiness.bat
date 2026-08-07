@echo off
title MelroseOS Historical Import Readiness

cd /d "%~dp0"

powershell ^
-NoProfile ^
-ExecutionPolicy Bypass ^
-File "%~dp0INT-07_HistoricalImportReadiness.ps1"

pause