@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "ROOT=%%~fI"

set "FAILURES=0"

echo.
echo ==========================================================
echo           MELROSEOS STARTUP HEALTH CHECK
echo ==========================================================
echo.

call :CHECK "%ROOT%\.git" "Git repository"
call :CHECK "%ROOT%\Build\Build-MelroseOS.bat" "Build launcher"
call :CHECK "%ROOT%\Build\Install-Module.bat" "Module installer"
call :CHECK "%ROOT%\DeveloperConsole\Run-DeveloperConsole.bat" "Developer Console"
call :CHECK "%ROOT%\DeveloperConsole\LeadMigration\DC-20_RunLeadMigration.bat" "Lead Migration runner"
call :CHECK "%ROOT%\DeveloperConsole\Validation\DC-30_RunAllValidation.bat" "Validation runner"
call :CHECK "%ROOT%\tools\LeadMigration\Certification\Run-FullCertification.bat" "Certification runner"
call :CHECK "%ROOT%\tools\LeadMigration\Certification\Reports\CERT-015-Final.json" "Final certification report"

echo.
if "%FAILURES%"=="0" (
    echo [PASS] Startup health check passed.
    exit /b 0
)

echo [FAIL] Startup health check found %FAILURES% issue(s).
exit /b 1

:CHECK
if exist "%~1" (
    echo [PASS] %~2
) else (
    echo [FAIL] %~2
    set /a FAILURES+=1
)
exit /b 0
