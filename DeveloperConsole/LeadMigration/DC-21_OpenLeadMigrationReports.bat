@echo off
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "ROOT=%%~fI"
set "REPORTS=%ROOT%\tools\LeadMigration\Reports"

if not exist "%REPORTS%" mkdir "%REPORTS%"

start "" explorer "%REPORTS%"
exit /b 0
