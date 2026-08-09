@echo off
setlocal EnableExtensions

set "ACTION_DIR=%~dp0"
for %%I in ("%ACTION_DIR%..\..") do set "ROOT=%%~fI"

if not exist "%ROOT%" (
    echo [FAIL] Repository not found:
    echo %ROOT%
    pause
    exit /b 1
)

start "" explorer "%ROOT%"
exit /b 0
