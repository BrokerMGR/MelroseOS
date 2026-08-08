@echo off
for %%F in (LM-26_GmailReadProfile.ps1 LM-27_MessageWindowBuilder.ps1 LM-28_CandidateMessageFilter.ps1 LM-29_ReadSimulation.ps1 LM-30_ReadinessSummary.ps1) do (
 powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0%%F"
 if errorlevel 1 exit /b 1
)
echo [PASS]