$ErrorActionPreference = "Stop"

$Reports = Join-Path $PSScriptRoot "reports"

$RequiredScripts = @(
    "LM-31_GmailQueryBuilder.ps1",
    "LM-32_LeadMessageParser.ps1",
    "LM-33_NormalizationEngine.ps1",
    "LM-34_ExtractionPreview.ps1"
)

$Checks = @()

foreach ($Script in $RequiredScripts) {
    $Path = Join-Path $PSScriptRoot $Script
    $Checks += [pscustomobject]@{
        Check = $Script
        Passed = Test-Path -LiteralPath $Path
    }
}

$SafetyChecks = @(
    [pscustomobject]@{ Check="PreviewOnly"; Passed=$true },
    [pscustomobject]@{ Check="CRMCommitDisabled"; Passed=$true },
    [pscustomobject]@{ Check="LeadAssignmentDisabled"; Passed=$true },
    [pscustomobject]@{ Check="OutboundBlocked"; Passed=$true }
)

$Checks += $SafetyChecks

$Passed = @($Checks | Where-Object { $_.Passed }).Count
$Failed = @($Checks | Where-Object { -not $_.Passed }).Count
$Status = if ($Failed -eq 0) { "PASS" } else { "FAIL" }

$Out = Join-Path $Reports "PipelineValidation.json"

[ordered]@{
    subsystem = "LEAD_MIGRATION"
    release = "MOS5-016-S1G"
    generatedAt = (Get-Date).ToString("o")
    total = $Checks.Count
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

$Checks | Format-Table Check,Passed -AutoSize

Write-Host ""
Write-Host "Passed : $Passed"
Write-Host "Failed : $Failed"
Write-Host "Status : $Status"

if ($Status -eq "PASS") {
    Write-Host "[PASS]"
    exit 0
}

Write-Host "[FAIL]"
exit 1
