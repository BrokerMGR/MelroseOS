@echo off
setlocal EnableExtensions

set "ACTION_DIR=%~dp0"
for %%I in ("%ACTION_DIR%..\..") do set "ROOT=%%~fI"
set "DEV=%ROOT%\Development"

if not exist "%DEV%" mkdir "%DEV%"

start "" explorer "%DEV%"
exit /b 0
