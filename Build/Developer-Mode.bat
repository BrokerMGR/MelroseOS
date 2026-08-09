@echo off
setlocal EnableExtensions EnableDelayedExpansion

title MelroseOS Developer Mode

set ROOT=D:\MelroseOS\GitHub\MelroseOS

:MENU
cls

echo.
echo =====================================================
echo           MELROSEOS DEVELOPER MODE
echo =====================================================
echo.
echo  [1] Create / Repair Structure
echo  [2] Create New Module
echo  [3] Install Source Modules
echo  [4] Validate Project
echo  [5] Build Project
echo  [6] Commit & Push
echo  [7] Full Pipeline
echo  [8] Open Project Folder
echo  [9] Open SourceModules
echo  [0] Exit
echo.
echo =====================================================
echo.

set /p OPTION=Select Option:

if "%OPTION%"=="1" call "%ROOT%\Create-MelroseOS-Structure.bat"
if "%OPTION%"=="2" call "%ROOT%\New-Module.bat"
if "%OPTION%"=="3" call "%ROOT%\Install-Module.bat"
if "%OPTION%"=="4" call "%ROOT%\tools\LeadMigration\Installers\Validate-MelroseOS.bat"
if "%OPTION%"=="5" call "%ROOT%\tools\LeadMigration\Installers\Build-MelroseOS.bat"
if "%OPTION%"=="6" call "%ROOT%\tools\LeadMigration\Installers\Commit-MelroseOS.bat"

if "%OPTION%"=="7" (

    call "%ROOT%\Install-Module.bat"

    if errorlevel 1 goto FAIL

    call "%ROOT%\tools\LeadMigration\Installers\Validate-MelroseOS.bat"

    if errorlevel 1 goto FAIL

    call "%ROOT%\tools\LeadMigration\Installers\Build-MelroseOS.bat"

    if errorlevel 1 goto FAIL

    call "%ROOT%\tools\LeadMigration\Installers\Commit-MelroseOS.bat"

    if errorlevel 1 goto FAIL

    echo.
    echo ==========================================
    echo ENTERPRISE PIPELINE COMPLETE
    echo ==========================================
    echo.
    echo [PASS]
    pause

)

if "%OPTION%"=="8" explorer "%ROOT%"
if "%OPTION%"=="9" explorer "%ROOT%\SourceModules"

if "%OPTION%"=="0" exit

goto MENU

:FAIL

echo.
echo ==========================================
echo PIPELINE FAILED
echo ==========================================
echo.
pause

goto MENU