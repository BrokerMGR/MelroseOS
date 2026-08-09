<#
MelroseOS Enterprise
Certification : CERT-004
Name          : Header and Release Certification
Release       : MOS5-017A
#>

$ErrorActionPreference = 'Stop'

$Common = 'D:\MelroseOS\GitHub\MelroseOS\tools\LeadMigration\Certification\Core\CERT-000_Common.ps1'
if (-not (Test-Path -LiteralPath $Common)) {
    Write-Host '[FAIL] CERT-000_Common.ps1 not found.' -ForegroundColor Red
    exit 1
}
. $Common

Write-CertHeader 'CERT-004 Header and Release Certification'

$Inventory = Get-CertModuleInventory
$Results = @()

foreach ($Module in $Inventory) {
    if ([string]::IsNullOrWhiteSpace([string]$Module.Path) -or -not (Test-Path -LiteralPath $Module.Path)) {
        $Results += [pscustomobject]@{
            Number = $Module.Number
            Name = $Module.Name
            HasHeader = $false
            HasRelease = $false
            Passed = $false
        }
        Write-CertFail "$($Module.Name) missing"
        continue
    }

    $Text = [System.IO.File]::ReadAllText($Module.Path)
    $HasHeader = ($Text -match '(?i)MelroseOS Enterprise')
    $HasRelease = ($Text -match '(?i)MOS5-016')
    $Passed = $HasHeader -and $HasRelease

    $Results += [pscustomobject]@{
        Number = $Module.Number
        Name = $Module.Name
        HasHeader = $HasHeader
        HasRelease = $HasRelease
        Passed = $Passed
    }

    if ($Passed) {
        Write-CertPass $Module.Name
    } else {
        Write-CertWarn "$($Module.Name) header/release metadata incomplete"
    }
}

$Failed = @($Results | Where-Object { -not $_.Passed }).Count

$Report = [ordered]@{
    release = 'MOS5-017A'
    targetRelease = 'MOS5-016'
    certification = 'CERT-004'
    generatedAt = (Get-Date).ToString('o')
    failedCount = $Failed
    passed = ($Failed -eq 0)
    results = $Results
}

$Path = Write-CertJson -Data $Report -FileName 'CERT-004-Headers.json'

if ($Failed -gt 0) {
    Write-CertFail "Header/release certification failed. Report: $Path"
    exit 1
}

Write-CertPass "Header/release certification passed. Report: $Path"
exit 0
