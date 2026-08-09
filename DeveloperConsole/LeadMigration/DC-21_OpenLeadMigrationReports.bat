@echo off
setlocal EnableExtensions
set "REPORTS=D:\MelroseOS\GitHub\MelroseOS\tools\LeadMigration\Reports"
if not exist "%REPORTS%" mkdir "%REPORTS%"
start "" explorer "%REPORTS%"
exit /b 0
