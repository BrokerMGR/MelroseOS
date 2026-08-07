$ErrorActionPreference = "Stop"

$Reports = Join-Path $PSScriptRoot "reports"

if (!(Test-Path $Reports)) {
    New-Item -ItemType Directory -Path $Reports -Force | Out-Null
}

$Lock = [ordered]@{

    Enabled = $true

    AllowCRMWrites = $false

    AllowEmail = $false

    AllowSMS = $false

    AllowAPI = $false

    AllowTriggerInstall = $false

    AllowRoundRobin = $false

    AllowProduction = $false

    LastModified = (Get-Date).ToString("o")

}

$Out = Join-Path $Reports "SafetyLock.json"

$Lock |
ConvertTo-Json -Depth 5 |
Set-Content `
-LiteralPath $Out `
-Encoding UTF8

Write-Host ""
Write-Host "MelroseOS Safety Lock"
Write-Host "====================="
Write-Host ""
Write-Host "Global Lock : ENABLED"
Write-Host "CRM Writes  : BLOCKED"
Write-Host "Email       : BLOCKED"
Write-Host "SMS         : BLOCKED"
Write-Host "API         : BLOCKED"
Write-Host "Production  : BLOCKED"
Write-Host ""
Write-Host "[PASS]"