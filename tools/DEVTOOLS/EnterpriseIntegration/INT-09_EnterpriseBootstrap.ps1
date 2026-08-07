$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot
$Reports = Join-Path $Root "reports"

if (!(Test-Path $Reports)) {
    New-Item -ItemType Directory -Path $Reports -Force | Out-Null
}

$Modules = @(
    "CrossProjectHealth.json",
    "DependencyResolver.json",
    "ConfigurationValidation.json",
    "SharedDataContracts.json",
    "CommunicationsIntegration.json",
    "RoutingIntegration.json",
    "DashboardIntegration.json",
    "HistoricalImportReadiness.json",
    "EndToEndIntegrationDiagnostics.json"
)

$Results = @()
$Passed = 0

foreach ($Module in $Modules) {

    $Path = Join-Path $Reports $Module

    $Success = $false
    $Status = "MISSING"

    if (Test-Path -LiteralPath $Path) {

        try {

            $Data =
                Get-Content `
                    -LiteralPath $Path `
                    -Raw |
                ConvertFrom-Json

            $Status = [string]$Data.status

            if ($Status -eq "PASS") {
                $Success = $true
                $Passed++
            }

        }
        catch {

            $Status = "INVALID"

        }

    }

    $Results += [pscustomobject]@{
        Module = $Module
        Status = $Status
        Passed = $Success
    }

}

$Failed = $Modules.Count - $Passed

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
        "EnterpriseIntegrationBootstrap.json"

[ordered]@{
    subsystem = "ENTERPRISE_INTEGRATION"
    release = "MOS5-015-INT-010"
    version = "1.0.0"
    generatedAt = (Get-Date).ToString("o")
    totalModules = $Modules.Count
    passed = $Passed
    failed = $Failed
    status = $Overall

    enterpriseFrameworkComplete =
        ($Overall -eq "PASS")

    productionEnabled = $false
    outboundBlocked = $true
    safetyLockEnabled = $true
    historicalImportEnabled = $false
    liveRoutingEnabled = $false

    modules = $Results

} |
ConvertTo-Json -Depth 10 |
Set-Content `
    -LiteralPath $Out `
    -Encoding UTF8

Write-Host ""
Write-Host "========================================"
Write-Host " MelroseOS Enterprise Integration"
Write-Host "========================================"
Write-Host ""

$Results |
Format-Table Module,Status,Passed -AutoSize

Write-Host ""
Write-Host "Completed : $Passed of $($Modules.Count)"
Write-Host "Failed    : $Failed"
Write-Host "Status    : $Overall"
Write-Host ""

Write-Host "Framework Complete : $($Overall -eq 'PASS')"
Write-Host "Production         : BLOCKED"
Write-Host "Outbound           : BLOCKED"
Write-Host "Safety Lock        : ENABLED"
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