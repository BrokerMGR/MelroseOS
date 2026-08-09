@echo off
setlocal EnableExtensions EnableDelayedExpansion
title MelroseOS Lead Migration Pipeline

set "ROOT=D:\MelroseOS\GitHub\MelroseOS"
set "ACTIVE=%ROOT%\tools\LeadMigration\Active"

cls
echo.
echo ==========================================================
echo            MELROSEOS LEAD MIGRATION PIPELINE
echo ==========================================================
echo.
echo Repository:
echo %ROOT%
echo.
echo Active Modules:
echo %ACTIVE%
echo.

if not exist "%ACTIVE%" (
  echo [FAIL] Active folder not found.
  pause
  exit /b 1
)

for /L %%N in (1,1,30) do (
  set "NUM=00%%N"
  set "NUM=!NUM:~-3!"
  set "MODULE="
  for %%F in ("%ACTIVE%\LM-!NUM!_*.ps1") do (
    if exist "%%~fF" set "MODULE=%%~fF"
  )

  if not defined MODULE (
    echo [FAIL] LM-!NUM! module not found.
    goto PIPELINE_FAIL
  )

  echo.
  echo ----------------------------------------------------------
  echo RUNNING !MODULE!
  echo ----------------------------------------------------------
  powershell -NoProfile -ExecutionPolicy Bypass -File "!MODULE!"
  if errorlevel 1 goto PIPELINE_FAIL

  echo [PASS] LM-!NUM!
)

goto PIPELINE_PASS

:PIPELINE_PASS
echo.
echo ==========================================================
echo             FULL PIPELINE COMPLETE
echo ==========================================================
echo.
echo [PASS] LM-001 through LM-030 completed.
echo.
pause
exit /b 0

:PIPELINE_FAIL
echo.
echo ==========================================================
echo              FULL PIPELINE FAILED
echo ==========================================================
echo.
echo [FAIL] Pipeline stopped on the first failed module.
echo.
pause
exit /b 1