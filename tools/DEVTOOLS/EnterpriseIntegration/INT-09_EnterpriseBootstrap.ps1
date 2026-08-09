$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot
$Reports = Join-Path $Root "reports"

if (!(Test-Path $Reports)) {
    New-Item -ItemType Directory -Path $Reports -Force | Out-Null
}

$Scripts = @(
    @{
        Name   = "INT-00_CrossProjectHealth.ps1"
        Report = "CrossProjectHealth.json"
    },
    @{
        Name   = "INT-01_DependencyResolver.ps1"
        Report = "DependencyResolver.json"
    },
    @{
        Name   = "INT-02_ConfigurationValidator.ps1"
        Report = "ConfigurationValidation.json"
    },
    @{
        Name   = "INT-03_SharedDataContracts.ps1"
        Report = "SharedDataContracts.json"
    },
    @{
        Name   = "INT-04_CommunicationsIntegration.ps1"
        Report = "CommunicationsIntegration.json"
    },
    @{
        Name   = "INT-05_RoutingIntegration.ps1"
        Report = "RoutingIntegration.json"
    },
    @{
        Name   = "INT-06_DashboardIntegration.ps1"
        Report = "DashboardIntegration.json"
    },
    @{
        Name   = "INT-07_HistoricalImportReadiness.ps1"
        Report = "HistoricalImportReadiness.json"
    },
    @{
        Name   = "INT-08_EndToEndDiagnostics.ps1"
        Report = "EndToEndIntegrationDiagnostics.json"
    }
)

$Results = @()
$Passed = 0

foreach ($Item in $Scripts) {

    $ScriptPath = Join-Path $Root $Item.Name
    $ReportPath = Join-Path $Reports $Item.Report

    Write-Host ""
    Write-Host "Running $($Item.Name)"

    $ScriptExists =
        Test-Path -LiteralPath $ScriptPath

    $ExitCode = 999

    if ($ScriptExists) {

        & powershell `
            -NoProfile `
            -ExecutionPolicy Bypass `
            -File $ScriptPath

        $ExitCode = $LASTEXITCODE

    }

    $ReportExists =
        Test-Path -LiteralPath $ReportPath

    $ReportStatus = "MISSING"

    if ($ReportExists) {

        try {

            $Data =
                Get-Content `
                    -LiteralPath $ReportPath `
                    -Raw |
                ConvertFrom-Json

            if ($Data.status) {
                $ReportStatus = [string]$Data.status
            }
            elseif ($ExitCode -eq 0) {
                $ReportStatus = "PASS"
            }
            else {
                $ReportStatus = "UNKNOWN"
            }

        }
        catch {

            $ReportStatus = "INVALID"

        }

    }

    $Success =
        $ScriptExists -and
        $ExitCode -eq 0 -and
        $ReportExists -and
        $ReportStatus -eq "PASS"

    if ($Success) {
        $Passed++
    }

    $Results += [pscustomobject]@{

        Module =
            $Item.Name

        ScriptExists =
            $ScriptExists

        ExitCode =
            $ExitCode

        Report =
            $Item.Report

        ReportExists =
            $ReportExists

        Status =
            $ReportStatus

        Passed =
            $Success

    }

}

$Failed =
    $Scripts.Count - $Passed

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

    subsystem =
        "ENTERPRISE_INTEGRATION"

    release =
        "MOS5-015-INT-010"

    version =
        "1.1.0"

    generatedAt =
        (Get-Date).ToString("o")

    totalModules =
        $Scripts.Count

    passed =
        $Passed

    failed =
        $Failed

    status =
        $Overall

    enterpriseFrameworkComplete =
        ($Overall -eq "PASS")

    productionEnabled =
        $false

    outboundBlocked =
        $true

    safetyLockEnabled =
        $true

    historicalImportEnabled =
        $false

    liveRoutingEnabled =
        $false

    modules =
        $Results

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
Format-Table `
    Module,
    ScriptExists,
    ReportExists,
    Status,
    Passed `
    -AutoSize

Write-Host ""
Write-Host "Completed : $Passed of $($Scripts.Count)"
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