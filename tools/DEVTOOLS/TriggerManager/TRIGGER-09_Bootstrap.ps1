$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot

Write-Host ""
Write-Host "======================================="
Write-Host " MelroseOS Enterprise Trigger Manager"
Write-Host "======================================="
Write-Host ""

$Scripts = @(
    "TRIGGER-00_Core.ps1",
    "TRIGGER-01_Inventory.ps1",
    "TRIGGER-02_HealthCheck.ps1",
    "TRIGGER-03_DuplicateDetector.ps1",
    "TRIGGER-04_MissingTriggerDetector.ps1",
    "TRIGGER-05_Installer.ps1",
    "TRIGGER-06_RepairEngine.ps1",
    "TRIGGER-07_Dashboard.ps1",
    "TRIGGER-08_Diagnostics.ps1"
)

$Passed = 0

foreach($Script in $Scripts){

    $Path = Join-Path $Root $Script

    Write-Host ""
    Write-Host "Running $Script"

    & powershell `
        -NoProfile `
        -ExecutionPolicy Bypass `
        -File $Path

    if($LASTEXITCODE -eq 0){
        $Passed++
    }

}

Write-Host ""
Write-Host "======================================="
Write-Host "Completed $Passed of $($Scripts.Count)"
Write-Host "======================================="

if($Passed -eq $Scripts.Count){

    Write-Host ""
    Write-Host "[PASS]"
    exit 0

}

Write-Host ""
Write-Host "[FAIL]"
exit 1