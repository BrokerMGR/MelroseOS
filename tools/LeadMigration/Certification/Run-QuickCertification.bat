@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=D:\MelroseOS\GitHub\MelroseOS"
set "SCRIPTS=%ROOT%\tools\LeadMigration\Certification\Scripts"

echo.
echo ==========================================================
echo        MELROSEOS QUICK CERTIFICATION
echo ==========================================================
echo.

for %%N in (001 002 003 004 005 006 010 012 013) do (
    set "FILE="
    for %%F in ("%SCRIPTS%\CERT-%%N_*.ps1") do if exist "%%~fF" set "FILE=%%~fF"

    if not defined FILE (
        echo [FAIL] CERT-%%N not found.
        pause
        exit /b 1
    )

    powershell -NoProfile -ExecutionPolicy Bypass -File "!FILE!"
    if errorlevel 1 (
        echo [FAIL] CERT-%%N failed.
        pause
        exit /b 1
    )
)

echo.
echo [PASS] Quick certification completed.
pause
exit /b 0
