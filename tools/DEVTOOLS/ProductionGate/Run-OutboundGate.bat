@echo off
title MelroseOS Outbound Gate

cd /d "%~dp0"

powershell ^
-NoProfile ^
-ExecutionPolicy Bypass ^
-File "%~dp0PG-02_OutboundGate.ps1"

pause