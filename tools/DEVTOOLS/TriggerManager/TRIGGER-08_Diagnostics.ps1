$ErrorActionPreference = "Stop"

$Reports = Join-Path $PSScriptRoot "reports"

$RequiredReports = @(
    "TriggerInventory.csv",
    "TriggerHealth.csv",
    "TriggerInstaller.csv",
    "TriggerRepairReport.csv"
)

$Checks = @()

foreach ($Report in $RequiredReports) {

    $Path = Join-Path $Reports $Report

    $Checks += [pscustomobject]@{
        Check  = $Report
        Passed = Test-Path -LiteralPath $Path
        Path   = $Path
    }

}

$Passed = @($Checks | Where-Object { $_.Passed }).Count
$Failed = @($Checks | Where-Object { -not $_.Passed }).Count

Write-Host ""
Write-Host "MelroseOS Trigger Manager Diagnostics"
Write-Host "====================================="
Write-Host ""

$Checks |
    Format-Table Check,Passed,Path -AutoSize

Write-Host ""
Write-Host "Passed : $Passed"
Write-Host "Failed : $Failed"

$Out =
    Join-Path $Reports "TriggerDiagnostics.json"

[ordered]@{
    generatedAt = (Get-Date).ToString("o")
    total       = $Checks.Count
    passed      = $Passed
    failed      = $Failed
    status      = if ($Failed -eq 0) { "PASS" } else { "FAIL" }
    checks      = $Checks
} |
ConvertTo-Json -Depth 10 |
Set-Content -LiteralPath $Out -Encoding UTF8

Write-Host ""
Write-Host "Report:"
Write-Host $Out
Write-Host ""

if ($Failed -eq 0) {
    Write-Host "[PASS]"
    exit 0
}

Write-Host "[FAIL]"
exit 1