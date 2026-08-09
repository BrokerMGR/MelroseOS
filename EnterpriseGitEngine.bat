@echo off
setlocal EnableExtensions

title MOS5-022 Enterprise Git Engine - Foundation Installer

set "ROOT=D:\MelroseOS\GitHub\MelroseOS"
set "EGE=%ROOT%\EnterpriseGitEngine"

echo.
echo ==========================================================
echo      MOS5-022 ENTERPRISE GIT ENGINE FOUNDATION
echo ==========================================================
echo.

if not exist "%ROOT%\.git" (
    echo [FAIL] MelroseOS repository not found.
    pause
    exit /b 1
)

echo Creating folder structure...

for %%D in (
"%EGE%"
"%EGE%\Core"
"%EGE%\Services"
"%EGE%\Certification"
"%EGE%\Diagnostics"
"%EGE%\Reports"
"%EGE%\Logs"
"%EGE%\Config"
"%EGE%\Tests"
"%EGE%\Templates"
"%EGE%\Documentation"
) do (
    if not exist "%%~D" mkdir "%%~D"
    echo [PASS] %%~D
)

echo.
echo Creating source files...

for %%F in (
"GIT-001_ProcessEngine.ps1"
"GIT-002_RepositoryDiscovery.ps1"
"GIT-003_CommandRunner.ps1"
"GIT-004_ErrorClassifier.ps1"
"GIT-005_Config.ps1"
"GIT-006_Logger.ps1"
"GIT-007_StatusService.ps1"
"GIT-008_CommitService.ps1"
"GIT-009_PushService.ps1"
"GIT-010_PullService.ps1"
"GIT-011_TagService.ps1"
"GIT-012_BranchService.ps1"
"GIT-013_VerificationService.ps1"
"GIT-014_Diagnostics.ps1"
"GIT-015_Utilities.ps1"
) do (
    if not exist "%EGE%\Core\%%~F" (
        type nul > "%EGE%\Core\%%~F"
    )
    echo [PASS] %%~F
)

echo.
echo Creating service files...

for %%F in (
"GITCERT-001.ps1"
"GITCERT-002.ps1"
"GITCERT-003.ps1"
"GitEngine.config.json"
"Run-GitDiagnostics.bat"
"Run-GitCertification.bat"
"Install-GitEngine.bat"
"README.md"
"CHANGELOG.md"
) do (
    if not exist "%EGE%\Services\%%~F" (
        type nul > "%EGE%\Services\%%~F"
    )
    echo [PASS] %%~F
)

echo.
echo Creating report folders...

if not exist "%EGE%\Reports\Daily" mkdir "%EGE%\Reports\Daily"
if not exist "%EGE%\Reports\Certification" mkdir "%EGE%\Reports\Certification"
if not exist "%EGE%\Reports\Diagnostics" mkdir "%EGE%\Reports\Diagnostics"

echo [PASS] Reports\Daily
echo [PASS] Reports\Certification
echo [PASS] Reports\Diagnostics

echo.
echo ==========================================================
echo FOUNDATION COMPLETE
echo ==========================================================
echo.
echo EnterpriseGitEngine has been created.
echo Ready for GIT-001 through GIT-005 source generation.
echo.
pause
exit /b 0