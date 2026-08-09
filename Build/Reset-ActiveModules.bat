@echo off
setlocal EnableExtensions EnableDelayedExpansion

title MelroseOS Active Module Reset

set "BUILD_DIR=%~dp0"

for %%I in ("%BUILD_DIR%..") do (
    set "ROOT=%%~fI"
)

set "ACTIVE=%ROOT%\tools\LeadMigration\Active"
set "BACKUPROOT=%ROOT%\tools\LeadMigration\Backups"

for /f %%I in ('powershell -NoProfile -Command "(Get-Date).ToString('yyyy-MM-dd_HHmmss')"') do (
    set "STAMP=%%I"
)

set "BACKUP=%BACKUPROOT%\Active-%STAMP%"

echo.
echo ==========================================
echo  MELROSEOS ACTIVE MODULE RESET
echo ==========================================
echo.

if not exist "%ACTIVE%" (
    echo [FAIL] Active folder not found.
    pause
    exit /b 1
)

if not exist "%BACKUPROOT%" mkdir "%BACKUPROOT%"
mkdir "%BACKUP%"

echo Backing up current Active modules...
echo.

copy /Y "%ACTIVE%\*.ps1" "%BACKUP%\" >nul

if errorlevel 1 (
    echo [FAIL] Backup failed.
    pause
    exit /b 1
)

echo [PASS] Backup:
echo %BACKUP%
echo.

echo Removing existing Active PowerShell modules...
del /Q "%ACTIVE%\*.ps1"

if errorlevel 1 (
    echo [FAIL] Unable to clear Active modules.
    pause
    exit /b 1
)

echo [PASS] Active cleared.
echo.

echo Reinstalling canonical modules...
call "%BUILD_DIR%Install-Module.bat"

if errorlevel 1 (
    echo [FAIL] Reinstallation failed.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo  ACTIVE MODULE RESET COMPLETE
echo ==========================================
echo.
echo Expected modules: 31
echo LM-000 plus LM-001 through LM-030
echo.
echo [PASS]
pause