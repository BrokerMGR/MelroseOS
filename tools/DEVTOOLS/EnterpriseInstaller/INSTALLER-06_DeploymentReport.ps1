$ErrorActionPreference = "Stop"

$ReportsRoot =
    Join-Path `
        $PSScriptRoot `
        "reports"

if (!(Test-Path -LiteralPath $ReportsRoot)) {

    New-Item `
        -Path $ReportsRoot `
        -ItemType Directory `
        -Force |
    Out-Null

}

$Required = @(
    "EnterpriseInstallerCore.json",
    "ProjectDiscovery.csv",
    "DeploymentValidation.csv",
    "AppsScriptPushPlan.csv",
    "TriggerIntegration.csv",
    "EnvironmentVerification.csv"
)

$Checks = @()

foreach ($File in $Required) {

    $Path =
        Join-Path `
            $ReportsRoot `
            $File

    $Checks +=
        [pscustomobject]@{

            Report =
                $File

            Exists =
                Test-Path -LiteralPath $Path

            Path =
                $Path

        }

}

$Passed =
    @(
        $Checks |
        Where-Object {
            $_.Exists
        }
    ).Count

$Failed =
    @(
        $Checks |
        Where-Object {
            !$_.Exists
        }
    ).Count

$Status =
    if ($Failed -eq 0) {
        "PASS"
    }
    else {
        "FAIL"
    }

$Report =
    [ordered]@{

        subsystem =
            "ENTERPRISE_INSTALLER"

        release =
            "MOS5-013-S1-007"

        version =
            "1.0.0"

        generatedAt =
            (Get-Date).ToString("o")

        totalChecks =
            $Checks.Count

        passed =
            $Passed

        failed =
            $Failed

        status =
            $Status

        checks =
            $Checks

    }

$Out =
    Join-Path `
        $ReportsRoot `
        "EnterpriseDeploymentReport.json"

$Report |
    ConvertTo-Json -Depth 10 |
    Set-Content `
        -LiteralPath $Out `
        -Encoding UTF8

Write-Host ""
Write-Host "MelroseOS Enterprise Deployment Report"
Write-Host "======================================"
Write-Host ""

$Checks |
    Format-Table `
        Report,
        Exists `
        -AutoSize

Write-Host ""
Write-Host "Passed : $Passed"
Write-Host "Failed : $Failed"
Write-Host "Status : $Status"
Write-Host ""
Write-Host "Report:"
Write-Host $Out
Write-Host ""

if ($Status -eq "PASS") {

    Write-Host "[PASS]"
    exit 0

}

Write-Host "[FAIL]"
exit 1