$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot
$Reports = Join-Path $Root "reports"

if (!(Test-Path $Reports)) {
    New-Item -ItemType Directory -Path $Reports -Force | Out-Null
}

$Scripts = @(
    "PG-00_Core.ps1",
    "PG-01_SafetyLockManager.ps1",
    "PG-02_OutboundGate.ps1",
    "PG-03_ProductionValidator.ps1",
    "PG-04_GoLiveChecklist.ps1"
)

$Results = @()
$Passed = 0

foreach ($Script in $Scripts) {

    $Path = Join-Path $Root $Script

    Write-Host ""
    Write-Host "Running $Script"

    & powershell `
        -NoProfile `
        -ExecutionPolicy Bypass `
        -File $Path

    $Success = ($LASTEXITCODE -eq 0)

    if ($Success) {
        $Passed++
    }

    $Results += [pscustomobject]@{
        Script = $Script
        Passed = $Success
    }

}

$Failed = $Scripts.Count - $Passed

$Overall =
    if ($Failed -eq 0) {
        "PASS"
    }
    else {
        "FAIL"
    }

$Out =
    Join-Path `
        $Reports `
        "ProductionGateMaster.json"

[ordered]@{
    subsystem = "PRODUCTION_GATE"
    release = "MOS5-014-S1-006"
    version = "1.0.0"
    generatedAt = (Get-Date).ToString("o")
    total = $Scripts.Count
    passed = $Passed
    failed = $Failed
    status = $Overall
    productionEnabled = $false
    safetyLock = $true
    outboundBlocked = $true
    results = $Results
} |
ConvertTo-Json -Depth 10 |
Set-Content -LiteralPath $Out -Encoding UTF8

Write-Host ""
Write-Host "========================================="
Write-Host " MelroseOS Production Gate"
Write-Host "========================================="
Write-Host ""
Write-Host "Completed : $Passed of $($Scripts.Count)"
Write-Host "Failed    : $Failed"
Write-Host "Status    : $Overall"
Write-Host ""
Write-Host "Production : BLOCKED"
Write-Host "Safety Lock: ENABLED"
Write-Host "Outbound   : BLOCKED"
Write-Host ""
Write-Host "Report:"
Write-Host $Out
Write-Host ""

if ($Overall -eq "PASS") {
    Write-Host "[PASS]"
    exit 0
}

Write-Host "[FAIL]"
exit 1