@echo off
setlocal EnableExtensions

title MelroseOS Code Indexer Full Suite

cd /d "%~dp0"

echo.
echo ==========================================
echo   MELROSEOS CODE INDEXER FULL SUITE
echo ==========================================
echo.

call Run-CodeIndexer.bat

echo.
echo Updating Developer Navigator...
powershell ^
  -ExecutionPolicy Bypass ^
  -File "%~dp0Update-DeveloperNavigator.ps1"

echo.
echo Checking duplicate functions...
powershell ^
  -ExecutionPolicy Bypass ^
  -File "%~dp0Find-DuplicateFunctions.ps1"

echo.
echo Checking orphaned code...
powershell ^
  -ExecutionPolicy Bypass ^
  -File "%~dp0Find-OrphanedCode.ps1"

echo.
echo Checking Apps Script mappings...
powershell ^
  -ExecutionPolicy Bypass ^
  -File "%~dp0Find-UnmappedProjects.ps1"

echo.
echo Validating Git and Apps Script structure...
powershell ^
  -ExecutionPolicy Bypass ^
  -File "%~dp0Validate-GitAppsScriptSync.ps1"

echo.
echo ==========================================
echo   CODE INDEXER SUITE COMPLETE
echo ==========================================
echo.

pause