<#
MelroseOS Enterprise
Certification : CERT-001
Name          : Structure Certification
Release       : MOS5-017A
#>

$ErrorActionPreference = 'Stop'

$Common = 'D:\MelroseOS\GitHub\MelroseOS\tools\LeadMigration\Certification\Core\CERT-000_Common.ps1'
if (-not (Test-Path -LiteralPath $Common)) {
    Write-Host '[FAIL] CERT-000_Common.ps1 not found.' -ForegroundColor Red
    exit 1
}
. $Common

Write-CertHeader 'CERT-001 Structure Certification'

$RequiredPaths = @(
    'D:\MelroseOS\GitHub\MelroseOS',
    'D:\MelroseOS\GitHub\MelroseOS\Build',
    'D:\MelroseOS\GitHub\MelroseOS\CoreModules',
    'D:\MelroseOS\GitHub\MelroseOS\Development',
    'D:\MelroseOS\GitHub\MelroseOS\tools\LeadMigration',
    'D:\MelroseOS\GitHub\MelroseOS\tools\LeadMigration\Active',
    'D:\MelroseOS\GitHub\MelroseOS\tools\LeadMigration\Reports',
    'D:\MelroseOS\GitHub\MelroseOS\tools\LeadMigration\Certification',
    'D:\MelroseOS\GitHub\MelroseOS\tools\LeadMigration\Certification\Scripts',
    'D:\MelroseOS\GitHub\MelroseOS\tools\LeadMigration\Certification\Core',
    'D:\MelroseOS\GitHub\MelroseOS\tools\LeadMigration\Certification\Reports',
    'D:\MelroseOS\GitHub\MelroseOS\tools\LeadMigration\Certification\Config'
)

$Results = @()

foreach ($Path in $RequiredPaths) {
    $Passed = Test-Path -LiteralPath $Path
    $Results += New-CertResult -Check $Path -Passed $Passed -Details $(if ($Passed) { 'Exists' } else { 'Missing' })

    if ($Passed) { Write-CertPass $Path } else { Write-CertFail $Path }
}

$Failed = @($Results | Where-Object { -not $_.Passed }).Count

$Report = [ordered]@{
    release = 'MOS5-017A'
    targetRelease = 'MOS5-016'
    certification = 'CERT-001'
    generatedAt = (Get-Date).ToString('o')
    passed = ($Failed -eq 0)
    failedCount = $Failed
    results = $Results
}

$Path = Write-CertJson -Data $Report -FileName 'CERT-001-Structure.json'

if ($Failed -gt 0) {
    Write-CertFail "Structure certification failed. Report: $Path"
    exit 1
}

Write-CertPass "Structure certification passed. Report: $Path"
exit 0
