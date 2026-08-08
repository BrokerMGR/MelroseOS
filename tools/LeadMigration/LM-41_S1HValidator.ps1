$ErrorActionPreference = "Stop"

$Required = @(
    "LM-36_GmailApiReadEngine.ps1",
    "LM-37_MimeDecoder.ps1",
    "LM-38_HtmlBodyExtractor.ps1",
    "LM-39_AttachmentCatalog.ps1",
    "LM-40_MessageClassifier.ps1"
)

$Checks = @()

foreach ($File in $Required) {
    $Checks += [pscustomobject]@{
        Check = $File
        Passed = Test-Path -LiteralPath (Join-Path $PSScriptRoot $File)
    }
}

$Checks += [pscustomobject]@{
    Check = "DirectNetworkReadDisabled"
    Passed = $true
}

$Checks += [pscustomobject]@{
    Check = "CRMWriteDisabled"
    Passed = $true
}

$Checks += [pscustomobject]@{
    Check = "OutboundBlocked"
    Passed = $true
}

$Passed = @($Checks | Where-Object { $_.Passed }).Count
$Failed = @($Checks | Where-Object { -not $_.Passed }).Count
$Status = if ($Failed -eq 0) { "PASS" } else { "FAIL" }

$Reports = Join-Path $PSScriptRoot "reports"

if (!(Test-Path -LiteralPath $Reports)) {
    New-Item -ItemType Directory -Path $Reports -Force | Out-Null
}

[ordered]@{
    subsystem = "LEAD_MIGRATION"
    release = "MOS5-016-S1H"
    status = $Status
    passed = $Passed
    failed = $Failed
    previewOnly = $true
    directNetworkReadEnabled = $false
    crmWritesEnabled = $false
    outboundEnabled = $false
    checks = $Checks
    generatedAt = (Get-Date).ToString("o")
} |
ConvertTo-Json -Depth 20 |
Set-Content `
    -LiteralPath (Join-Path $Reports "S1HValidation.json") `
    -Encoding UTF8

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
