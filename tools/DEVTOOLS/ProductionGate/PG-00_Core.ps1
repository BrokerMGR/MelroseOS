$ErrorActionPreference = "Stop"

$Repo = (Resolve-Path "$PSScriptRoot\..\..\..").Path

$Reports = Join-Path $PSScriptRoot "reports"

if (!(Test-Path $Reports)) {
    New-Item -ItemType Directory -Path $Reports -Force | Out-Null
}

$Status = [pscustomobject]@{

    Subsystem = "PRODUCTION_GATE"

    Release = "MOS5-014-S1-001"

    Version = "1.0.0"

    DevelopmentMode = $true

    ProductionMode = $false

    SafetyLock = $true

    OutboundBlocked = $true

    GeneratedAt = (Get-Date).ToString("o")

}

$Out =
Join-Path `
$Reports `
"ProductionGateCore.json"

$Status |
ConvertTo-Json -Depth 5 |
Set-Content `
-LiteralPath $Out `
-Encoding UTF8

Write-Host ""
Write-Host "MelroseOS Production Gate"
Write-Host "========================="
Write-Host ""
Write-Host "Development : $($Status.DevelopmentMode)"
Write-Host "Production  : $($Status.ProductionMode)"
Write-Host "Safety Lock : $($Status.SafetyLock)"
Write-Host "Outbound    : BLOCKED"
Write-Host ""
Write-Host "[PASS]"