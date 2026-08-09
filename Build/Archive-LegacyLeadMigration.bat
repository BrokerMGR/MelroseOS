@echo off
setlocal EnableExtensions EnableDelayedExpansion

title MelroseOS Legacy Migration Utility

REM ==========================================================
REM MelroseOS Enterprise
REM Archive Legacy Lead Migration Files
REM Version 1.0.0
REM ==========================================================

set ROOT=D:\MelroseOS\GitHub\MelroseOS
set LMROOT=%ROOT%\tools\LeadMigration

for /f %%i in ('powershell -NoProfile -Command "(Get-Date).ToString('yyyy-MM-dd_HHmmss')"') do set STAMP=%%i

set LEGACY=%LMROOT%\Legacy\%STAMP%

cls

echo.
echo ==========================================================
echo      MELROSEOS LEGACY MIGRATION UTILITY
echo ==========================================================
echo.

if not exist "%LMROOT%" (

    echo [FAIL] LeadMigration folder not found.
    pause
    exit /b 1

)

mkdir "%LEGACY%" >nul 2>&1

echo.
echo Creating Archive Folder...
echo.

echo %LEGACY%

echo.

set MOVED=0
set FAILED=0

echo ----------------------------------------------------------
echo Moving Legacy PowerShell Modules
echo ----------------------------------------------------------
echo.

for /L %%i in (1,1,150) do (

    set NUM=00%%i
    set NUM=!NUM:~-3!

    if exist "%LMROOT%\LM-!NUM!.ps1" (

        move "%LMROOT%\LM-!NUM!.ps1" "%LEGACY%" >nul

        if errorlevel 1 (

            echo [FAIL] LM-!NUM!.ps1
            set /a FAILED+=1

        ) else (

            echo [PASS] LM-!NUM!.ps1
            set /a MOVED+=1

        )

    )

)

echo.
echo ----------------------------------------------------------
echo Moving Legacy BAT Files
echo ----------------------------------------------------------
echo.

call :MoveFile Run-All.bat
call :MoveFile Install.bat
call :MoveFile Validate.ps1

echo.
echo ----------------------------------------------------------
echo Creating README
echo ----------------------------------------------------------
echo.

(
echo Legacy Lead Migration Archive
echo.
echo Created:
echo %DATE% %TIME%
echo.
echo This folder contains the original Lead Migration
echo flat-file architecture retained for rollback.
echo.
echo Safe to keep.
)> "%LEGACY%\README.txt"

echo.
echo ==========================================================
echo          LEGACY MIGRATION COMPLETE
echo ==========================================================
echo.

echo Archive Folder:
echo %LEGACY%
echo.

echo Files Moved : %MOVED%
echo Failed      : %FAILED%

echo.

if %FAILED% GTR 0 (

    echo [WARNING] Some files could not be moved.

) else (

    echo [PASS] All legacy files archived successfully.

)

echo.
pause
exit /b 0

:MoveFile

if exist "%LMROOT%\%~1" (

    move "%LMROOT%\%~1" "%LEGACY%" >nul

    if errorlevel 1 (

        echo [FAIL] %~1
        set /a FAILED+=1

    ) else (

        echo [PASS] %~1
        set /a MOVED+=1

    )

)

exit /b