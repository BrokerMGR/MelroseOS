$ErrorActionPreference = "Stop"

$Repo = (Resolve-Path "$PSScriptRoot\..\..\..").Path
$Reports = Join-Path $PSScriptRoot "reports"
$Projects = Join-Path $Repo "PROJECTS"

if (!(Test-Path $Reports)) {
    New-Item -ItemType Directory -Path $Reports -Force | Out-Null
}

$Checks = @()

$RequiredFiles = @(
    @{
        Name = "BCC Enterprise Integration"
        Path = "BCC\src\BCC-04_EnterpriseIntegration.js"
    },
    @{
        Name = "BCC Dashboard Data Adapter"
        Path = "BCC\src\BCC-03_DashboardDataAdapter.js"
    },
    @{
        Name = "INTAKE Dashboard Provider"
        Path = "INTAKE\src\INTAKE-71_BrokerDashboardProvider.js"
    },
    @{
        Name = "INTAKE Runtime Diagnostics"
        Path = "INTAKE\src\INTAKE-48_RuntimeDiagnostics.js"
    }
)

foreach ($Item in $RequiredFiles) {

    $FullPath =
        Join-Path `
            $Projects `
            $Item.Path

    $Checks += [pscustomobject]@{
        Check = $Item.Name
        Passed = Test-Path -LiteralPath $FullPath
        Path = $FullPath
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

$Out =
    Join-Path `
        $Reports `
        "DashboardIntegration.json"

[ordered]@{
    subsystem = "ENTERPRISE_INTEGRATION"
    release = "MOS5-015-INT-007"
    generatedAt = (Get-Date).ToString("o")
    passed = $Passed
    failed = $Failed
    status = if ($Failed -eq 0) { "PASS" } else { "FAIL" }
    dashboardActivationAllowed = $false
    productionDataWritesAllowed = $false
    checks = $Checks
} |
ConvertTo-Json -Depth 10 |
Set-Content -LiteralPath $Out -Encoding UTF8

Write-Host ""
Write-Host "Enterprise Dashboard Integration"
Write-Host "================================"
Write-Host ""

$Checks |
    Format-Table Check,Passed,Path -AutoSize

Write-Host ""
Write-Host "Passed : $Passed"
Write-Host "Failed : $Failed"
Write-Host "Live Dashboard Writes : BLOCKED"
Write-Host ""

if ($Failed -eq 0) {
    Write-Host "[PASS]"
    exit 0
}

Write-Host "[FAIL]"
exit 1