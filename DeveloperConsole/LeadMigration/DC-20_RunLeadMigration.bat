@echo off
setlocal EnableExtensions EnableDelayedExpansion

title MelroseOS Lead Migration Pipeline

set "ROOT=D:\MelroseOS\GitHub\MelroseOS"
set "ACTIVE=D:\MelroseOS\GitHub\MelroseOS\tools\LeadMigration\Active"

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
    echo [FAIL] Active module folder not found:
    echo %ACTIVE%
    pause
    exit /b 1
)

call :RUN "LM-001_EnterpriseCore.ps1"
if errorlevel 1 goto FAIL
call :RUN "LM-002_GmailDiscovery.ps1"
if errorlevel 1 goto FAIL
call :RUN "LM-003_MessageInventory.ps1"
if errorlevel 1 goto FAIL
call :RUN "LM-004_LeadExtraction.ps1"
if errorlevel 1 goto FAIL
call :RUN "LM-005_LeadParser.ps1"
if errorlevel 1 goto FAIL
call :RUN "LM-006_EntityRecognition.ps1"
if errorlevel 1 goto FAIL
call :RUN "LM-007_Normalization.ps1"
if errorlevel 1 goto FAIL
call :RUN "LM-008_DuplicateDetection.ps1"
if errorlevel 1 goto FAIL
call :RUN "LM-009_MergeEngine.ps1"
if errorlevel 1 goto FAIL
call :RUN "LM-010_CRMWriter.ps1"
if errorlevel 1 goto FAIL
call :RUN "LM-011_CRMValidator.ps1"
if errorlevel 1 goto FAIL
call :RUN "LM-012_AttachmentDiscovery.ps1"
if errorlevel 1 goto FAIL
call :RUN "LM-013_AttachmentProcessor.ps1"
if errorlevel 1 goto FAIL
call :RUN "LM-014_LabelManager.ps1"
if errorlevel 1 goto FAIL
call :RUN "LM-015_HistoryBuilder.ps1"
if errorlevel 1 goto FAIL
call :RUN "LM-016_ConversationMerger.ps1"
if errorlevel 1 goto FAIL
call :RUN "LM-017_TimelineBuilder.ps1"
if errorlevel 1 goto FAIL
call :RUN "LM-018_AgentResolver.ps1"
if errorlevel 1 goto FAIL
call :RUN "LM-019_BrokerReview.ps1"
if errorlevel 1 goto FAIL
call :RUN "LM-020_ComplianceScanner.ps1"
if errorlevel 1 goto FAIL
call :RUN "LM-021_ExceptionHandler.ps1"
if errorlevel 1 goto FAIL
call :RUN "LM-022_DataQuality.ps1"
if errorlevel 1 goto FAIL
call :RUN "LM-023_Importer.ps1"
if errorlevel 1 goto FAIL
call :RUN "LM-024_Exporter.ps1"
if errorlevel 1 goto FAIL
call :RUN "LM-025_Reporting.ps1"
if errorlevel 1 goto FAIL
call :RUN "LM-026_Diagnostics.ps1"
if errorlevel 1 goto FAIL
call :RUN "LM-027_Performance.ps1"
if errorlevel 1 goto FAIL
call :RUN "LM-028_Backup.ps1"
if errorlevel 1 goto FAIL
call :RUN "LM-029_Restore.ps1"
if errorlevel 1 goto FAIL
call :RUN "LM-030_ReleaseManager.ps1"
if errorlevel 1 goto FAIL

echo.
echo ==========================================================
echo             FULL PIPELINE COMPLETE
echo ==========================================================
echo.
echo [PASS] LM-001 through LM-030 completed.
echo.
pause
exit /b 0

:RUN
echo.
echo ----------------------------------------------------------
echo RUNNING %~1
echo ----------------------------------------------------------
echo.

if not exist "%ACTIVE%\%~1" (
    echo [FAIL] Missing module:
    echo %ACTIVE%\%~1
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%ACTIVE%\%~1"
set "RC=%ERRORLEVEL%"

if not "%RC%"=="0" (
    echo.
    echo [FAIL] %~1 returned exit code %RC%.
    exit /b %RC%
)

echo [PASS] %~1
exit /b 0

:FAIL
echo.
echo ==========================================================
echo              FULL PIPELINE FAILED
echo ==========================================================
echo.
echo [FAIL] Pipeline stopped on the first failed module.
echo.
pause
exit /b 1
