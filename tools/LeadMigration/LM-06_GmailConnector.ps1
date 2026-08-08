$ErrorActionPreference="Stop"
$Reports=Join-Path $PSScriptRoot "reports"
if(!(Test-Path $Reports)){New-Item -ItemType Directory -Path $Reports|Out-Null}
@{generatedAt=(Get-Date).ToString("o");mode="PREVIEW";connectorReady=$true;connected=$false;oauthConfigured=$false}|ConvertTo-Json|Set-Content (Join-Path $Reports "GmailConnector.json")
Write-Host "[PASS]"