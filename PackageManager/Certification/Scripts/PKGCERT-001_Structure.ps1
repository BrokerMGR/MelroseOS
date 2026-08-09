<#
MelroseOS Enterprise
Package Manager Certification
Module : PKGCERT-001_Structure
Release: MOS5-018
#>

$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\PackageManager\Certification\Core\PKGCERT-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){Write-Host '[FAIL] PKGCERT-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

Write-PKGCertHeader 'PKGCERT-001 Structure'

$Required=@(
    'D:\MelroseOS\GitHub\MelroseOS',
    'D:\MelroseOS\GitHub\MelroseOS\PackageManager',
    'D:\MelroseOS\GitHub\MelroseOS\PackageManager\Core',
    'D:\MelroseOS\GitHub\MelroseOS\PackageManager\Scripts',
    'D:\MelroseOS\GitHub\MelroseOS\PackageManager\Config',
    'D:\MelroseOS\GitHub\MelroseOS\PackageManager\Registry',
    'D:\MelroseOS\GitHub\MelroseOS\PackageManager\Manifests',
    'D:\MelroseOS\GitHub\MelroseOS\PackageManager\Packages',
    'D:\MelroseOS\GitHub\MelroseOS\PackageManager\Reports',
    'D:\MelroseOS\GitHub\MelroseOS\PackageManager\Logs',
    'D:\MelroseOS\GitHub\MelroseOS\PackageManager\Certification',
    'D:\MelroseOS\GitHub\MelroseOS\PackageManager\Certification\Scripts',
    'D:\MelroseOS\GitHub\MelroseOS\PackageManager\Certification\Reports'
)

$Results=@()

foreach($Path in $Required){
    $Exists=Test-Path -LiteralPath $Path
    $Results += [pscustomobject]@{
        Path=$Path
        Exists=$Exists
        Passed=$Exists
    }

    if($Exists){Write-PKGCertPass $Path}else{Write-PKGCertFail $Path}
}

$Failed=@($Results|Where-Object{-not $_.Passed}).Count

$Report=[ordered]@{
    release='MOS5-018'
    certification='PKGCERT-001'
    generatedAt=(Get-Date).ToString('o')
    failedCount=$Failed
    passed=($Failed-eq0)
    results=$Results
}

$Path=Write-PKGCertJson -Data $Report -FileName 'PKGCERT-001-Structure.json'

if($Failed-gt0){
    Write-PKGCertFail "Structure certification failed. Report: $Path"
    exit 1
}

Write-PKGCertPass "Structure certification passed. Report: $Path"
exit 0
