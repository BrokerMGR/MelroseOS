@echo off
for %%F in (LM-21_GmailConnectionProfile.ps1 LM-22_HistoricalMessageCatalog.ps1 LM-23_LeadSourceClassifier.ps1 LM-24_ImportPreviewBuilder.ps1 LM-25_ExtractionGate.ps1) do (
 powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0%%F"
 if errorlevel 1 exit /b 1
)
echo [PASS]