@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=D:\MelroseOS\GitHub\MelroseOS"
set "SCRIPTS=%ROOT%\PackageManager\Certification\Scripts"

echo.
echo ==========================================================
echo        MOS5-018 FULL PACKAGE CERTIFICATION
echo ==========================================================
echo.

for /L %%I in (1,1,12) do (
    set "NUM=00%%I"
    set "NUM=!NUM:~-3!"
    set "FILE="

    for %%F in ("%SCRIPTS%\PKGCERT-!NUM!_*.ps1") do if exist "%%~fF" set "FILE=%%~fF"

    if not defined FILE (
        echo [FAIL] PKGCERT-!NUM! not found.
        pause
        exit /b 1
    )

    echo.
    echo ----------------------------------------------------------
    echo RUNNING PKGCERT-!NUM!
    echo ----------------------------------------------------------
    powershell -NoProfile -ExecutionPolicy Bypass -File "!FILE!"
    if errorlevel 1 (
        echo.
        echo [FAIL] PKGCERT-!NUM! failed.
        pause
        exit /b 1
    )
)

echo.
echo ==========================================================
echo      PACKAGE CERTIFICATION COMPLETE
echo ==========================================================
echo.
echo [PASS] PKGCERT-001 through PKGCERT-012 completed.
pause
exit /b 0
