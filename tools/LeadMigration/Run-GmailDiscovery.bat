@echo off
for %%F in (LM-06_GmailConnector.ps1 LM-07_LabelScanner.ps1 LM-08_MailboxScanner.ps1 LM-09_MessageInventory.ps1 LM-10_DiscoveryStatistics.ps1) do (
 powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0%%F"
 if errorlevel 1 exit /b 1
)
echo [PASS]
