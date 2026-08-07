$Root = (Resolve-Path "$PSScriptRoot\..\..\..").Path

Write-Host ""
Write-Host "===================================="
Write-Host " MelroseOS Post Push Automation"
Write-Host "===================================="
Write-Host ""

Write-Host "Updating Code Index..."
powershell -ExecutionPolicy Bypass -File "$PSScriptRoot\Index-MelroseOS-Code.ps1"

Write-Host ""
Write-Host "Updating Developer Navigator..."
powershell -ExecutionPolicy Bypass -File "$PSScriptRoot\Update-DeveloperNavigator.ps1"

Write-Host ""
Write-Host "Done."