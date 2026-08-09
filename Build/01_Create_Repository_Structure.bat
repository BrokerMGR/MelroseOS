@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM ============================================================
REM MelroseOS GitHub-Relative BAT Workflow
REM Auto-detects the Git repository root.
REM No hardcoded D:\MelroseOS path.
REM ============================================================

set "SCRIPT_DIR=%~dp0"
pushd "%SCRIPT_DIR%" >nul 2>&1

for /f "delims=" %%G in ('git rev-parse --show-toplevel 2^>nul') do set "ROOT=%%G"

if not defined ROOT (
    REM Fallback: assume BAT is inside <repo>\Build\
    for %%I in ("%SCRIPT_DIR%..") do set "ROOT=%%~fI"
)

if not exist "%ROOT%\.git" (
    echo.
    echo [ERROR] Could not locate the MelroseOS Git repository.
    echo.
    echo Put this BAT inside the repository or inside a Build subfolder.
    echo Expected structure:
    echo   MelroseOS\
    echo     .git\
    echo     Build\
    echo       this-file.bat
    echo.
    popd >nul 2>&1
    pause
    exit /b 1
)

echo.
echo ============================================================
echo  MelroseOS Repository Detected
echo  ROOT: %ROOT%
echo ============================================================
echo.

title MelroseOS - Create Repository Structure

for %%D in (
  "%ROOT%\Build"
  "%ROOT%\AppsScript"
  "%ROOT%\AppsScript\Core"
  "%ROOT%\AppsScript\CRM"
  "%ROOT%\AppsScript\Marketing"
  "%ROOT%\AppsScript\Website"
  "%ROOT%\AppsScript\Analytics"
  "%ROOT%\AppsScript\Archive"
  "%ROOT%\AppsScript\Shared"
  "%ROOT%\Deploy"
  "%ROOT%\Deploy\Batches"
  "%ROOT%\Releases"
  "%ROOT%\Logs"
  "%ROOT%\Backups"
  "%ROOT%\Config"
  "%ROOT%\Docs"
  "%ROOT%\Temp"
) do (
  if not exist "%%~D" (
    mkdir "%%~D"
    if errorlevel 1 (
      echo [ERROR] Could not create: %%~D
      popd >nul 2>&1
      pause
      exit /b 1
    ) else (
      echo [CREATED] %%~D
    )
  ) else (
    echo [EXISTS]  %%~D
  )
)

call :touch "%ROOT%\Logs\.keep"
call :touch "%ROOT%\Backups\.keep"
call :touch "%ROOT%\Releases\.keep"
call :touch "%ROOT%\Temp\.keep"

echo.
echo ============================================================
echo  COMPLETE
echo  Repository structure created inside:
echo  %ROOT%
echo ============================================================
echo.

popd >nul 2>&1
pause
exit /b 0

:touch
if not exist "%~1" (
  type nul > "%~1"
  echo [CREATED] %~1
) else (
  echo [EXISTS]  %~1
)
exit /b 0
