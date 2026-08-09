@echo off
setlocal EnableExtensions

title MelroseOS Development Consolidator

set "ROOT=D:\MelroseOS\GitHub\MelroseOS"
set "OLDDEV=%ROOT%\Development"
set "DEV=D:\MelroseOS\Development"
set "ACTIVE=%ROOT%\tools\LeadMigration\Active"

echo.
echo ==========================================
echo  MELROSEOS DEVELOPMENT CONSOLIDATOR
echo ==========================================
echo.

if not exist "%DEV%" mkdir "%DEV%"

echo Moving repository Development modules...
echo.

for %%F in ("%OLDDEV%\*.ps1") do (
    if exist "%%~fF" (
        move /Y "%%~fF" "%DEV%\%%~nxF" >nul
        echo [PASS] %%~nxF
    )
)

echo.
echo Checking LM-003...
echo.

if not exist "%DEV%\LM-003_MessageInventory.ps1" (
    if exist "%ACTIVE%\LM-003_MessageInventory.ps1" (
        copy /Y "%ACTIVE%\LM-003_MessageInventory.ps1" "%DEV%\LM-003_MessageInventory.ps1" >nul
        echo [PASS] LM-003_MessageInventory.ps1 recovered from Active
    ) else (
        echo [WARN] LM-003_MessageInventory.ps1 not found in Active
    )
) else (
    echo [PASS] LM-003_MessageInventory.ps1 already present
)

echo.
echo ==========================================
echo  DEVELOPMENT MODULE INVENTORY
echo ==========================================
echo.

dir /b "%DEV%\LM-*.ps1"

echo.
echo ==========================================
echo  CONSOLIDATION COMPLETE
echo ==========================================
echo.
echo Canonical Development Folder:
echo %DEV%
echo.
echo [PASS]
pause