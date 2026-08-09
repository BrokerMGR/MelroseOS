@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "MENU_DIR=%~dp0"
for %%I in ("%MENU_DIR%..\..") do set "ROOT=%%~fI"
set "TESTS=%ROOT%\tools\LeadMigration\ValidationSuite\Scripts"

:MENU
cls
echo.
echo ==========================================================
echo               VALIDATION SUITE CONSOLE
echo ==========================================================
echo.
echo   1. Structure Validation
echo   2. Module Load Validation
echo   3. Pipeline Simulation
echo   4. Duplicate Detection
echo   5. Broker Review
echo   6. Import Preview
echo   7. Performance
echo   8. Final Validation
echo   9. Run ALL Tests
echo.
echo   0. Back
echo.
echo ==========================================================
echo.

set /p "CHOICE=Select Option: "

if "%CHOICE%"=="1" call :RUN "LM-Test-001_StructureValidation.ps1"
if "%CHOICE%"=="2" call :RUN "LM-Test-002_ModuleLoadValidation.ps1"
if "%CHOICE%"=="3" call :RUN "LM-Test-003_PipelineSimulation.ps1"
if "%CHOICE%"=="4" call :RUN "LM-Test-004_DuplicateDetection.ps1"
if "%CHOICE%"=="5" call :RUN "LM-Test-005_BrokerReview.ps1"
if "%CHOICE%"=="6" call :RUN "LM-Test-006_ImportPreview.ps1"
if "%CHOICE%"=="7" call :RUN "LM-Test-007_Performance.ps1"
if "%CHOICE%"=="8" call :RUN "LM-Test-008_FinalValidation.ps1"
if "%CHOICE%"=="9" call "%ROOT%\DeveloperConsole\Validation\DC-30_RunAllValidation.bat"
if "%CHOICE%"=="0" exit /b 0

goto MENU

:RUN
cls
if not exist "%TESTS%\%~1" (
  echo [FAIL] Missing test: %~1
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%TESTS%\%~1"
echo.
pause
exit /b 0
