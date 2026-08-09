@echo off
setlocal EnableExtensions EnableDelayedExpansion

title MelroseOS Validation Suite Runner

set "ROOT=D:\MelroseOS\GitHub\MelroseOS"
set "TESTS=%ROOT%\tools\LeadMigration\ValidationSuite\Scripts"

cls
echo.
echo ==========================================================
echo             MELROSEOS VALIDATION SUITE
echo ==========================================================
echo.

if not exist "%TESTS%" (
    echo [FAIL] Validation scripts folder not found:
    echo %TESTS%
    pause
    exit /b 1
)

for /L %%I in (1,1,8) do (
    set "NUM=00%%I"
    set "NUM=!NUM:~-3!"
    set "TESTFILE="

    for %%F in ("%TESTS%\LM-Test-!NUM!_*.ps1") do (
        if exist "%%~fF" set "TESTFILE=%%~fF"
    )

    if not defined TESTFILE (
        echo.
        echo [FAIL] LM-Test-!NUM! not found.
        goto VALIDATION_FAIL
    )

    echo.
    echo ----------------------------------------------------------
    echo RUNNING LM-Test-!NUM!
    echo ----------------------------------------------------------
    echo.

    powershell -NoProfile -ExecutionPolicy Bypass -File "!TESTFILE!"
    if errorlevel 1 (
        echo.
        echo [FAIL] LM-Test-!NUM! failed.
        goto VALIDATION_FAIL
    )

    echo [PASS] LM-Test-!NUM!
)

goto VALIDATION_PASS

:VALIDATION_PASS
echo.
echo ==========================================================
echo            VALIDATION SUITE COMPLETE
echo ==========================================================
echo.
echo [PASS] LM-Test-001 through LM-Test-008 completed.
echo.
pause
exit /b 0

:VALIDATION_FAIL
echo.
echo ==========================================================
echo             VALIDATION SUITE FAILED
echo ==========================================================
echo.
echo [FAIL] Validation stopped on the first failed test.
echo.
pause
exit /b 1
