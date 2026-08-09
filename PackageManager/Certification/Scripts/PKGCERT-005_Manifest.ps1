<#
MelroseOS Enterprise
Package Manager Certification
Module : PKGCERT-005_Manifest
Release: MOS5-018
#>

$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\PackageManager\Certification\Core\PKGCERT-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){Write-Host '[FAIL] PKGCERT-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

Write-PKGCertHeader 'PKGCERT-005 Manifest'

$CatalogPath='D:\MelroseOS\GitHub\MelroseOS\PackageManager\Manifests\PackageCatalog.json'

if(!(Test-Path -LiteralPath $CatalogPath)){
    Write-PKGCertFail "PackageCatalog.json not found: $CatalogPath"
    exit 1
}

try{
    $Catalog=Get-Content -LiteralPath $CatalogPath -Raw|ConvertFrom-Json
}catch{
    Write-PKGCertFail 'PackageCatalog.json is invalid JSON.'
    exit 1
}

$Results=@()

foreach($Package in @($Catalog.packages)){
    $Id=[string]$Package.id
    $Name=[string]$Package.name
    $Source=[string]$Package.source
    $SourcePath=Join-Path $Global:PKGCERT_ROOT $Source

    $Passed=(
        -not [string]::IsNullOrWhiteSpace($Id) -and
        -not [string]::IsNullOrWhiteSpace($Name) -and
        -not [string]::IsNullOrWhiteSpace($Source) -and
        (Test-Path -LiteralPath $SourcePath)
    )

    $Results+=[pscustomobject]@{
        id=$Id
        name=$Name
        source=$Source
        sourcePath=$SourcePath
        sourceExists=(Test-Path -LiteralPath $SourcePath)
        passed=$Passed
    }

    if($Passed){
        Write-PKGCertPass "$Id manifest"
    }else{
        Write-PKGCertFail "$Id manifest"
    }
}

$Failed=@($Results|Where-Object{-not $_.passed}).Count

$Report=[ordered]@{
    release='MOS5-018'
    certification='PKGCERT-005'
    generatedAt=(Get-Date).ToString('o')
    failedCount=$Failed
    passed=($Failed-eq0)
    packages=$Results
}

$Path=Write-PKGCertJson -Data $Report -FileName 'PKGCERT-005-Manifest.json'

if($Failed-gt0){
    Write-PKGCertFail "Manifest certification failed. Report: $Path"
    exit 1
}

Write-PKGCertPass "Manifest certification passed. Report: $Path"
exit 0
