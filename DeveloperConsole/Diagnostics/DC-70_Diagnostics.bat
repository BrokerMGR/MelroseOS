@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "ROOT=%%~fI"

cls
echo.
echo ==========================================================
echo                 MELROSEOS DIAGNOSTICS
echo ==========================================================
echo.

set "FAILURES=0"

call :CHECKDIR "%ROOT%" "Repository"
call :CHECKDIR "%ROOT%\Build" "Build"
call :CHECKDIR "%ROOT%\Development" "Development"
call :CHECKDIR "%ROOT%\CoreModules" "CoreModules"
call :CHECKDIR "%ROOT%\PROJECTS" "Projects"
call :CHECKDIR "%ROOT%\DeveloperConsole" "DeveloperConsole"
call :CHECKDIR "%ROOT%\tools\LeadMigration\Active" "LeadMigration Active"
call :CHECKDIR "%ROOT%\tools\LeadMigration\Certification" "Certification"

call :CHECKFILE "%ROOT%\CoreModules\LM-000_Common.ps1" "LM-000 Common"
call :CHECKFILE "%ROOT%\DeveloperConsole\Run-DeveloperConsole.bat" "Developer Console Launcher"
call :CHECKFILE "%ROOT%\DeveloperConsole\LeadMigration\DC-20_RunLeadMigration.bat" "Lead Migration Runner"
call :CHECKFILE "%ROOT%\DeveloperConsole\Validation\DC-30_RunAllValidation.bat" "Validation Runner"
call :CHECKFILE "%ROOT%\tools\LeadMigration\Certification\Run-Certification.bat" "Certification Runner"

echo.
echo ----------------------------------------------------------
echo Git
echo ----------------------------------------------------------
where git >nul 2>&1
if errorlevel 1 (
    echo [FAIL] Git executable not found.
    set /a FAILURES+=1
) else (
    echo [PASS] Git executable available.
)

echo.
echo ----------------------------------------------------------
echo PowerShell
echo ----------------------------------------------------------
where powershell >nul 2>&1
if errorlevel 1 (
    echo [FAIL] PowerShell not found.
    set /a FAILURES+=1
) else (
    echo [PASS] PowerShell available.
)

echo.
echo ==========================================================
echo                  DIAGNOSTIC RESULT
echo ==========================================================
echo.

if "%FAILURES%"=="0" (
    echo [PASS] Core MelroseOS developer environment is healthy.
    pause
    exit /b 0
)

echo [FAIL] %FAILURES% diagnostic check(s) failed.
pause
exit /b 1

:CHECKDIR
if exist "%~1\" (
    echo [PASS] %~2
) else (
    echo [FAIL] %~2 - %~1
    set /a FAILURES+=1
)
exit /b 0

:CHECKFILE
if exist "%~1" (
    for %%A in ("%~1") do (
        if %%~zA GTR 0 (
            echo [PASS] %~2
        ) else (
            echo [FAIL] %~2 - empty file
            set /a FAILURES+=1
        )
    )
) else (
    echo [FAIL] %~2 - %~1
    set /a FAILURES+=1
)
exit /b 0
