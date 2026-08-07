$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot

Write-Host ""
Write-Host "========================================="
Write-Host " MelroseOS Enterprise Installer"
Write-Host "========================================="
Write-Host ""

$Scripts = @(
    "INSTALLER-00_Core.ps1",
    "INSTALLER-01_ProjectDiscovery.ps1",
    "INSTALLER-02_DeploymentValidator.ps1",
    "INSTALLER-03_AppsScriptPushEngine.ps1",
    "INSTALLER-04_TriggerIntegration.ps1",
    "INSTALLER-05_EnvironmentVerification.ps1",
    "INSTALLER-06_DeploymentReport.ps1"
)

$Passed = 0
$Results = @()

foreach($Script in $Scripts){

    $Path = Join-Path $Root $Script

    Write-Host ""
    Write-Host "Running $Script"

    & powershell `
        -NoProfile `
        -ExecutionPolicy Bypass `
        -File $Path

    $Success = ($LASTEXITCODE -eq 0)

    if($Success){
        $Passed++
    }

    $Results += [pscustomobject]@{
        Script = $Script
        Passed = $Success
    }

}

$ReportFolder = Join-Path $Root "reports"

if(!(Test-Path $ReportFolder)){
    New-Item -ItemType Directory -Path $ReportFolder | Out-Null
}

$Results |
Export-Csv `
    (Join-Path $ReportFolder "EnterpriseInstallerBootstrap.csv") `
    -NoTypeInformation

Write-Host ""
Write-Host "========================================="
Write-Host "Completed $Passed of $($Scripts.Count)"
Write-Host "========================================="

if($Passed -eq $Scripts.Count){

    Write-Host ""
    Write-Host "[PASS]"
    exit 0

}

Write-Host ""
Write-Host "[FAIL]"
exit 1