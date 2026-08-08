@echo off
for %%F in (LM-16_BrokerReviewQueue.ps1 LM-17_MigrationPreview.ps1 LM-18_OwnershipAudit.ps1 LM-19_MigrationDashboard.ps1 LM-20_ReadinessGate.ps1) do (
 powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0%%F"
 if errorlevel 1 exit /b 1
)
echo [PASS]
