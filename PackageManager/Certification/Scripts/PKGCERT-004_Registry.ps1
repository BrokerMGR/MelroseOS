<#
MelroseOS Enterprise
Package Manager Certification
Module : PKGCERT-004_Registry
Release: MOS5-018
#>

$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\PackageManager\Certification\Core\PKGCERT-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){Write-Host '[FAIL] PKGCERT-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

Write-PKGCertHeader 'PKGCERT-004 Registry'

$RegistryPath='D:\MelroseOS\GitHub\MelroseOS\PackageManager\Registry\packages.json'

if(!(Test-Path -LiteralPath $RegistryPath)){
    Write-PKGCertFail "Registry not found: $RegistryPath"
    exit 1
}

try{
    $Registry=Get-Content -LiteralPath $RegistryPath -Raw|ConvertFrom-Json
}catch{
    Write-PKGCertFail 'packages.json is invalid JSON.'
    exit 1
}

$Packages=@($Registry.packages)
$Ids=@($Packages|ForEach-Object{[string]$_.id})
$Duplicates=@($Ids|Group-Object|Where-Object{$_.Count -gt 1}|ForEach-Object{$_.Name})
$MissingIds=@($Packages|Where-Object{[string]::IsNullOrWhiteSpace([string]$_.id)})

$Passed=($Duplicates.Count-eq0 -and $MissingIds.Count-eq0)

$Report=[ordered]@{
    release='MOS5-018'
    certification='PKGCERT-004'
    generatedAt=(Get-Date).ToString('o')
    packageCount=$Packages.Count
    duplicateIds=$Duplicates
    missingIdCount=$MissingIds.Count
    passed=$Passed
}

$Path=Write-PKGCertJson -Data $Report -FileName 'PKGCERT-004-Registry.json'

if(-not $Passed){
    Write-PKGCertFail "Registry certification failed. Report: $Path"
    exit 1
}

Write-PKGCertPass "Registry certification passed. Report: $Path"
exit 0
