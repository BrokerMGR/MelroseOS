$ErrorActionPreference = "Stop"

$Reports = Join-Path $PSScriptRoot "reports"

$Required = @(
    "MailboxDiscovery.json",
    "GmailAccountInventory.json",
    "LabelDiscovery.json",
    "SourceInventory.json"
)

$Checks = @()

foreach ($File in $Required) {
    $Path = Join-Path $Reports $File
    $Exists = Test-Path -LiteralPath $Path

    $Checks += [pscustomobject]@{
        Report = $File
        Exists = $Exists
        Path = $Path
    }
}

$Passed = @($Checks | Where-Object { $_.Exists }).Count
$Failed = @($Checks | Where-Object { -not $_.Exists }).Count
$Status = if ($Failed -eq 0) { "PASS" } else { "FAIL" }

$Out = Join-Path $Reports "DiscoverySummary.json"

[ordered]@{
    subsystem = "LEAD_MIGRATION"
    release = "MOS5-016-S1A-B1"
    generatedAt = (Get-Date).ToString("o")
    totalChecks = $Checks.Count
    passed = $Passed
    failed = $Failed
    status = $Status
    previewOnly = $true
    commitEnabled = $false
    outboundBlocked = $true
    checks = $Checks
} |
ConvertTo-Json -Depth 10 |
Set-Content -LiteralPath $Out -Encoding UTF8

Write-Host ""
Write-Host "Lead Migration Discovery Summary"
Write-Host "================================"
Write-Host ""

$Checks | Format-Table Report,Exists -AutoSize

Write-Host ""
Write-Host "Passed : $Passed"
Write-Host "Failed : $Failed"
Write-Host "Status : $Status"
Write-Host "Commit : DISABLED"
Write-Host "Outbound: BLOCKED"
Write-Host ""

if ($Status -eq "PASS") {
    Write-Host "[PASS]"
    exit 0
}

Write-Host "[FAIL]"
exit 1
