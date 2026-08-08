@echo off
for %%F in (LM-11_HistoricalEmailParser.ps1 LM-12_LeadFingerprintEngine.ps1 LM-13_DuplicateDetector.ps1 LM-14_CRMMatcher.ps1 LM-15_PreviewQueue.ps1) do (
 powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0%%F"
 if errorlevel 1 exit /b 1
)
echo [PASS]
