$ErrorActionPreference = "Stop"

$Repo = (Resolve-Path "$PSScriptRoot\..\..\..").Path
$Reports = Join-Path $PSScriptRoot "reports"

if (!(Test-Path $Reports)) {
    New-Item -ItemType Directory -Path $Reports -Force | Out-Null
}

$Checks = @()

$Checks += [pscustomobject]@{
    Check = "Production Validation Report"
    Passed = Test-Path (Join-Path $Reports "ProductionValidation.json")
}

$Checks += [pscustomobject]@{
    Check = "Safety Lock Report"
    Passed = Test-Path (Join-Path $Reports "SafetyLock.json")
}

$Checks += [pscustomobject]@{
    Check = "Outbound Gate Report"
    Passed = Test-Path (Join-Path $Reports "OutboundGate.json")
}

$Checks += [pscustomobject]@{
    Check = "Enterprise Installer"
    Passed = Test-Path (
        Join-Path $Repo `
        "tools\DEVTOOLS\EnterpriseInstaller\reports\EnterpriseDeploymentReport.json"
    )
}

$Checks += [pscustomobject]@{
    Check = "Trigger Diagnostics"
    Passed = Test-Path (
        Join-Path $Repo `
        "tools\DEVTOOLS\TriggerManager\reports\TriggerDiagnostics.json"
    )
}

$Checks += [pscustomobject]@{
    Check = "Git Apps Script Validation"
    Passed = Test-Path (
        Join-Path $Repo `
        "tools\DEVTOOLS\CodeIndexer\reports\GitAppsScriptValidation.json"
    )
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

$Status =
    if ($Failed -eq 0) {
        "PASS"
    }
    else {
        "FAIL"
    }

$Out =
    Join-Path `
        $Reports `
        "GoLiveChecklist.json"

[ordered]@{

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

    productionActivationAllowed =
        $false

    safetyLockRequired =
        $true

    outboundBlockedRequired =
        $true

    checks =
        $Checks

} |
ConvertTo-Json -Depth 10 |
Set-Content `
    -LiteralPath $Out `
    -Encoding UTF8

Write-Host ""
Write-Host "MelroseOS Go-Live Checklist"
Write-Host "==========================="
Write-Host ""

$Checks |
    Format-Table Check,Passed -AutoSize

Write-Host ""
Write-Host "Passed : $Passed"
Write-Host "Failed : $Failed"
Write-Host "Status : $Status"
Write-Host ""
Write-Host "Production Activation : BLOCKED"
Write-Host "Safety Lock           : REQUIRED"
Write-Host "Outbound              : BLOCKED"
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