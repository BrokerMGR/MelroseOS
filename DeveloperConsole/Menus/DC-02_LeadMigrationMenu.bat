@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "MENU_DIR=%~dp0"
for %%I in ("%MENU_DIR%..\..") do set "ROOT=%%~fI"
set "LM=%ROOT%\tools\LeadMigration\Active"

:MENU
cls
echo.
echo ==========================================================
echo               LEAD MIGRATION CONSOLE
echo ==========================================================
echo.
echo   1. Enterprise Core
echo   2. Gmail Discovery
echo   3. Message Inventory
echo   4. Lead Extraction
echo   5. Lead Parser
echo   6. Entity Recognition
echo   7. Normalization
echo   8. Duplicate Detection
echo   9. Merge Engine
echo  10. CRM Writer Preview
echo  11. CRM Validator
echo  12. Broker Review
echo  13. Compliance Scanner
echo  14. Reporting
echo  15. Diagnostics
echo  16. Full Safe Pipeline
echo.
echo   0. Back
echo.
echo ==========================================================
echo.

set /p "CHOICE=Select Option: "

if "%CHOICE%"=="1" call :RUN "LM-001_EnterpriseCore.ps1"
if "%CHOICE%"=="2" call :RUN "LM-002_GmailDiscovery.ps1"
if "%CHOICE%"=="3" call :RUN "LM-003_MessageInventory.ps1"
if "%CHOICE%"=="4" call :RUN "LM-004_LeadExtraction.ps1"
if "%CHOICE%"=="5" call :RUN "LM-005_LeadParser.ps1"
if "%CHOICE%"=="6" call :RUN "LM-006_EntityRecognition.ps1"
if "%CHOICE%"=="7" call :RUN "LM-007_Normalization.ps1"
if "%CHOICE%"=="8" call :RUN "LM-008_DuplicateDetection.ps1"
if "%CHOICE%"=="9" call :RUN "LM-009_MergeEngine.ps1"
if "%CHOICE%"=="10" call :RUN "LM-010_CRMWriter.ps1"
if "%CHOICE%"=="11" call :RUN "LM-011_CRMValidator.ps1"
if "%CHOICE%"=="12" call :RUN "LM-019_BrokerReview.ps1"
if "%CHOICE%"=="13" call :RUN "LM-020_ComplianceScanner.ps1"
if "%CHOICE%"=="14" call :RUN "LM-025_Reporting.ps1"
if "%CHOICE%"=="15" call :RUN "LM-026_Diagnostics.ps1"
if "%CHOICE%"=="16" call "%ROOT%\DeveloperConsole\LeadMigration\DC-20_RunLeadMigration.bat"
if "%CHOICE%"=="0" exit /b 0

goto MENU

:RUN
cls
if not exist "%LM%\%~1" (
  echo [FAIL] Missing module: %~1
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%LM%\%~1"
echo.
pause
exit /b 0
