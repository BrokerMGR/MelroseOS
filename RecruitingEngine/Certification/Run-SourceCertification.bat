@echo off
setlocal EnableExtensions

title MOS5-021 Source Certification

set "ROOT=D:\MelroseOS\GitHub\MelroseOS"
set "SCRIPTS=%ROOT%\RecruitingEngine\Certification\Scripts"

echo ==========================================================
echo       MOS5-021 SOURCE CERTIFICATION
echo ==========================================================
echo.

for %%N in (001 002 003 004 005 006) do (
  echo.
  echo ----------------------------------------------------------
  echo RUNNING RECCERT-%%N
  echo ----------------------------------------------------------
  for %%F in ("%SCRIPTS%\RECCERT-%%N_*.ps1") do (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%%~fF"
    if errorlevel 1 (
      echo.
      echo [FAIL] RECCERT-%%N failed.
      pause
      exit /b 1
    )
  )
)

echo.
echo ==========================================================
echo       MOS5-021 SOURCE CERTIFICATION COMPLETE
echo ==========================================================
echo [PASS] RECCERT-001 through RECCERT-006 completed.
echo.
pause
exit /b 0
