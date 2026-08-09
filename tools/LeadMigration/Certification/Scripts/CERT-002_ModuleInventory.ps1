<#
MelroseOS Enterprise
Certification : CERT-002
Name          : Module Inventory
Release       : MOS5-017A
#>

$ErrorActionPreference = 'Stop'

$Common = 'D:\MelroseOS\GitHub\MelroseOS\tools\LeadMigration\Certification\Core\CERT-000_Common.ps1'
if (-not (Test-Path -LiteralPath $Common)) {
    Write-Host '[FAIL] CERT-000_Common.ps1 not found.' -ForegroundColor Red
    exit 1
}
. $Common

Write-CertHeader 'CERT-002 Module Inventory'

$Inventory = Get-CertModuleInventory
$Results = @()

foreach ($Module in $Inventory) {
    $Exists = (-not [string]::IsNullOrWhiteSpace([string]$Module.Path)) -and (Test-Path -LiteralPath $Module.Path)
    $Size = if ($Exists) { (Get-Item -LiteralPath $Module.Path).Length } else { 0 }
    $Passed = $Exists -and ($Size -gt 100)

    $Results += [pscustomobject]@{
        Number = $Module.Number
        Name = $Module.Name
        Path = $Module.Path
        Exists = $Exists
        SizeBytes = $Size
        Passed = $Passed
    }

    if ($Passed) {
        Write-CertPass "$($Module.Name) ($Size bytes)"
    } else {
        Write-CertFail "$($Module.Name) missing or too small"
    }
}

$Failed = @($Results | Where-Object { -not $_.Passed }).Count

$Report = [ordered]@{
    release = 'MOS5-017A'
    targetRelease = 'MOS5-016'
    certification = 'CERT-002'
    generatedAt = (Get-Date).ToString('o')
    expectedModuleCount = 31
    actualModuleCount = $Results.Count
    failedCount = $Failed
    passed = ($Results.Count -eq 31 -and $Failed -eq 0)
    modules = $Results
}

$Path = Write-CertJson -Data $Report -FileName 'CERT-002-ModuleInventory.json'

if (-not $Report.passed) {
    Write-CertFail "Module inventory certification failed. Report: $Path"
    exit 1
}

Write-CertPass "31/31 modules inventoried. Report: $Path"
exit 0
