@echo off
setlocal EnableExtensions EnableDelayedExpansion

title MelroseOS Build File Organizer

REM ==========================================================
REM MelroseOS Enterprise
REM Build File Organizer
REM Version 1.0.0
REM ==========================================================

set ROOT=D:\MelroseOS\GitHub\MelroseOS
set BUILD=%ROOT%\Build

cls

echo.
echo ==========================================================
echo          MELROSEOS BUILD ORGANIZER
echo ==========================================================
echo.

if not exist "%ROOT%" (
    echo [FAIL] Repository not found.
    pause
    exit /b 1
)

if not exist "%BUILD%" (
    mkdir "%BUILD%"
)

set MOVED=0
set FAILED=0

call :MoveFile Build-MelroseOS.bat
call :MoveFile Commit-MelroseOS.bat
call :MoveFile Create-MelroseOS-Structure.bat
call :MoveFile Install-Module.bat
call :MoveFile New-Module.bat
call :MoveFile Run-MelroseOS.bat
call :MoveFile Validate-MelroseOS.bat
call :MoveFile Developer-Mode.bat
call :MoveFile Archive-LegacyLeadMigration.bat
call :MoveFile Cleanup-MelroseOS-Tools.bat
call :MoveFile Create-MelroseOS-ModuleInjector.bat
call :MoveFile Preview-MelroseOS-Projects.bat
call :MoveFile Register-MelroseOS-Projects.bat
call :MoveFile Create-INTAKE-Project.bat
call :MoveFile Find-MelroseOS-Code.bat
call :MoveFile Find-AppsScript-Function.bat
call :MoveFile MelroseOS-Developer-Navigator.bat

echo.
echo ==========================================================
echo BUILD FILE ORGANIZATION COMPLETE
echo ==========================================================
echo.
echo Files Moved : %MOVED%
echo Failed      : %FAILED%
echo.
echo Build Folder:
echo %BUILD%
echo.
echo [PASS]
pause
exit /b 0

:MoveFile

if exist "%ROOT%\%~1" (

    move "%ROOT%\%~1" "%BUILD%" >nul

    if errorlevel 1 (

        echo [FAIL] %~1
        set /a FAILED+=1

    ) else (

        echo [PASS] %~1
        set /a MOVED+=1

    )

)

exit /b