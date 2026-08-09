@echo off
setlocal EnableExtensions EnableDelayedExpansion

title MelroseOS Enterprise Structure Builder v2.0

REM ======================================================
REM MELROSEOS ENTERPRISE STRUCTURE BUILDER
REM MOS5-016
REM ======================================================

set ROOT=D:\MelroseOS\GitHub\MelroseOS
set LMROOT=%ROOT%\tools\LeadMigration

echo.
echo ===============================================
echo     MELROSEOS ENTERPRISE STRUCTURE BUILDER
echo ===============================================
echo.

REM --------------------------------------------------
REM ROOT
REM --------------------------------------------------

if not exist "%ROOT%" mkdir "%ROOT%"
if not exist "%ROOT%\tools" mkdir "%ROOT%\tools"

REM --------------------------------------------------
REM LEAD MIGRATION
REM --------------------------------------------------

mkdir "%LMROOT%" 2>nul

mkdir "%LMROOT%\Active" 2>nul
mkdir "%LMROOT%\Archive" 2>nul

mkdir "%LMROOT%\Config" 2>nul
mkdir "%LMROOT%\Reports" 2>nul
mkdir "%LMROOT%\Logs" 2>nul
mkdir "%LMROOT%\Tests" 2>nul
mkdir "%LMROOT%\Installers" 2>nul
mkdir "%LMROOT%\Templates" 2>nul
mkdir "%LMROOT%\Exports" 2>nul
mkdir "%LMROOT%\Imports" 2>nul
mkdir "%LMROOT%\Backups" 2>nul

echo.
echo Creating Enterprise Modules...
echo.

set Modules= ^
LM-001_EnterpriseCore ^
LM-002_GmailDiscovery ^
LM-003_MessageInventory ^
LM-004_LeadExtraction ^
LM-005_EntityRecognition ^
LM-006_Normalization ^
LM-007_DuplicateDetection ^
LM-008_MergeEngine ^
LM-009_OwnershipProtection ^
LM-010_ConflictResolution ^
LM-011_CRMImport ^
LM-012_GmailSync ^
LM-013_AttachmentProcessor ^
LM-014_LabelManager ^
LM-015_ImportQueue ^
LM-016_BrokerReview ^
LM-017_AuditLogger ^
LM-018_Validation ^
LM-019_Reporting ^
LM-020_Installer ^
LM-021_TestSuite ^
LM-022_Configuration ^
LM-023_Utilities ^
LM-024_ErrorRecovery ^
LM-025_Backup ^
LM-026_Restore ^
LM-027_Performance ^
LM-028_Diagnostics ^
LM-029_Deployment ^
LM-030_ReleaseManager

for %%M in (%Modules%) do (

    if not exist "%LMROOT%\Active\%%M.ps1" (

        type nul > "%LMROOT%\Active\%%M.ps1"

        echo Created %%M.ps1

    )

)

echo.
echo Creating Reserved Modules...
echo.

for /L %%i in (31,1,150) do (

    set NUM=00%%i
    set NUM=!NUM:~-3!

    if not exist "%LMROOT%\Archive\LM-!NUM!.ps1" (

        type nul > "%LMROOT%\Archive\LM-!NUM!.ps1"

    )

)

echo.
echo Creating Configuration Files...

type nul > "%LMROOT%\Config\MigrationConfig.json"
type nul > "%LMROOT%\Config\Settings.json"
type nul > "%LMROOT%\Config\Mapping.json"

echo.
echo Creating Reports...

type nul > "%LMROOT%\Reports\MigrationReport.json"
type nul > "%LMROOT%\Reports\ValidationReport.json"

echo.
echo Creating Installers...

type nul > "%LMROOT%\Installers\Build-MelroseOS.bat"
type nul > "%LMROOT%\Installers\Commit-MelroseOS.bat"
type nul > "%LMROOT%\Installers\Validate-MelroseOS.bat"

echo.
echo Creating Test Files...

for /L %%i in (1,1,30) do (

    set NUM=00%%i
    set NUM=!NUM:~-3!

    if not exist "%LMROOT%\Tests\Test-!NUM!.ps1" (

        type nul > "%LMROOT%\Tests\Test-!NUM!.ps1"

    )

)

echo.
echo ===============================================
echo STRUCTURE COMPLETE
echo ===============================================

echo.

echo Active Modules  : 30
echo Archive Modules : 120
echo Tests           : 30
echo Config          : 3
echo Reports         : 2
echo Installers      : 3

echo.

echo Root:
echo %LMROOT%

echo.

echo [PASS]

pause