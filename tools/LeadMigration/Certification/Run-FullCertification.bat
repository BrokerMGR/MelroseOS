@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=D:\MelroseOS\GitHub\MelroseOS"
set "SCRIPTS=%ROOT%\tools\LeadMigration\Certification\Scripts"

echo.
echo ==========================================================
echo         MELROSEOS FULL CERTIFICATION
echo ==========================================================
echo.

for /L %%I in (1,1,15) do (
    set "NUM=00%%I"
    set "NUM=!NUM:~-3!"
    set "FILE="

    for %%F in ("%SCRIPTS%\CERT-!NUM!_*.ps1") do if exist "%%~fF" set "FILE=%%~fF"

    if not defined FILE (
        echo [FAIL] CERT-!NUM! not found.
        pause
        exit /b 1
    )

    echo.
    echo ----------------------------------------------------------
    echo RUNNING CERT-!NUM!
    echo ----------------------------------------------------------
    powershell -NoProfile -ExecutionPolicy Bypass -File "!FILE!"
    if errorlevel 1 (
        echo.
        echo [FAIL] CERT-!NUM! failed.
        pause
        exit /b 1
    )
)

echo.
echo ==========================================================
echo        FULL CERTIFICATION COMPLETE
echo ==========================================================
echo.
echo [PASS] CERT-001 through CERT-015 completed.
pause
exit /b 0
