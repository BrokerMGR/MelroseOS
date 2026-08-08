@echo off
setlocal EnableExtensions

title MelroseOS Lead Migration Discovery

cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0LM-01_MailboxDiscovery.ps1"
if errorlevel 1 goto :fail

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0LM-02_GmailAccountInventory.ps1"
if errorlevel 1 goto :fail

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0LM-03_LabelDiscovery.ps1"
if errorlevel 1 goto :fail

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0LM-04_SourceInventory.ps1"
if errorlevel 1 goto :fail

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0LM-05_DiscoveryReport.ps1"
if errorlevel 1 goto :fail

echo.
echo [PASS] MOS5-016-S1A Batch 1 discovery completed.
exit /b 0

:fail
echo.
echo [FAIL] MOS5-016-S1A Batch 1 discovery failed.
exit /b 1
