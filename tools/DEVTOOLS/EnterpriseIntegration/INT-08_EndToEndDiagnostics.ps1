$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot
$Reports = Join-Path $Root "reports"

if (!(Test-Path $Reports)) {
    New-Item -ItemType Directory -Path $Reports -Force | Out-Null
}

$RequiredReports = @(
    "CrossProjectHealth.json",
    "DependencyResolver.json",
    "ConfigurationValidation.json",
    "SharedDataContracts.json",
    "CommunicationsIntegration.json",
    "RoutingIntegration.json",
    "DashboardIntegration.json",
    "HistoricalImportReadiness.json"
)

$Checks = @()

foreach ($Report in $RequiredReports) {

    $Path = Join-Path $Reports $Report

    $Exists = Test-Path -LiteralPath $Path
    $Status = "MISSING"

    if ($Exists) {

        try {

            $Data =
                Get-Content `
                    -LiteralPath $Path `
                    -Raw |
                ConvertFrom-Json

            $Status =
                if ($Data.status) {
                    [string]$Data.status
                }
                else {
                    "UNKNOWN"
                }

        }
        catch {

            $Status = "INVALID"

        }

    }

    $Checks += [pscustomobject]@{
        Report = $Report
        Exists = $Exists
        Status = $Status
        Passed = (
            $Exists -and
            $Status -eq "PASS"
        )
    }

}

$Passed =
    @(
        $Checks |
        Where-Object {
            $_.Passed
        }
    ).Count

$Failed =
    @(
        $Checks |
        Where-Object {
            -not $_.Passed
        }
    ).Count

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
        "EndToEndIntegrationDiagnostics.json"

[ordered]@{
    subsystem = "ENTERPRISE_INTEGRATION"
    release = "MOS5-015-INT-009"
    generatedAt = (Get-Date).ToString("o")
    total = $Checks.Count
    passed = $Passed
    failed = $Failed
    status = $Overall
    productionEnabled = $false
    liveRoutingEnabled = $false
    outboundCommunicationsEnabled = $false
    historicalImportEligible = ($Overall -eq "PASS")
    checks = $Checks
} |
ConvertTo-Json -Depth 10 |
Set-Content -LiteralPath $Out -Encoding UTF8

Write-Host ""
Write-Host "MelroseOS End-to-End Integration Diagnostics"
Write-Host "============================================"
Write-Host ""

$Checks |
    Format-Table Report,Exists,Status,Passed -AutoSize

Write-Host ""
Write-Host "Passed : $Passed"
Write-Host "Failed : $Failed"
Write-Host "Status : $Overall"
Write-Host ""
Write-Host "Production : BLOCKED"
Write-Host "Routing    : BLOCKED"
Write-Host "Outbound   : BLOCKED"
Write-Host ""

if ($Overall -eq "PASS") {
    Write-Host "[PASS]"
    exit 0
}

Write-Host "[FAIL]"
exit 1