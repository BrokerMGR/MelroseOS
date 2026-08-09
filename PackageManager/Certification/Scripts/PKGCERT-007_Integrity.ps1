<#
MelroseOS Enterprise
Package Manager Certification
Module : PKGCERT-007_Integrity
Release: MOS5-018
#>
$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\PackageManager\Certification\Core\PKGCERT-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){Write-Host '[FAIL] PKGCERT-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

Write-PKGCertHeader 'PKGCERT-007 Integrity'

$ReportPath='D:\MelroseOS\GitHub\MelroseOS\PackageManager\Reports\PKG-005-Integrity.json'
if(!(Test-Path -LiteralPath $ReportPath)){
    Write-PKGCertFail "Integrity report not found: $ReportPath"
    exit 1
}

try{
    $Data=Get-Content -LiteralPath $ReportPath -Raw|ConvertFrom-Json
}catch{
    Write-PKGCertFail 'PKG-005-Integrity.json is invalid JSON.'
    exit 1
}

$Passed=[bool]$Data.passed
$FailedCount=if($null-ne$Data.failedCount){[int]$Data.failedCount}else{0}

$Report=[ordered]@{
    release='MOS5-018'
    certification='PKGCERT-007'
    generatedAt=(Get-Date).ToString('o')
    sourceReport=$ReportPath
    sourcePassed=$Passed
    failedCount=$FailedCount
    passed=$Passed
}

$Path=Write-PKGCertJson -Data $Report -FileName 'PKGCERT-007-Integrity.json'

if(-not $Passed){
    Write-PKGCertFail "Integrity certification failed. Report: $Path"
    exit 1
}

Write-PKGCertPass "Integrity certification passed. Report: $Path"
exit 0
