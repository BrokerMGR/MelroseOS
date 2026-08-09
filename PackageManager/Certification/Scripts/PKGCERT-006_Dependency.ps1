<#
MelroseOS Enterprise
Package Manager Certification
Module : PKGCERT-006_Dependency
Release: MOS5-018
#>

$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\PackageManager\Certification\Core\PKGCERT-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){Write-Host '[FAIL] PKGCERT-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

Write-PKGCertHeader 'PKGCERT-006 Dependency'

$CatalogPath='D:\MelroseOS\GitHub\MelroseOS\PackageManager\Manifests\PackageCatalog.json'
if(!(Test-Path -LiteralPath $CatalogPath)){
    Write-PKGCertFail 'PackageCatalog.json not found.'
    exit 1
}

$Catalog=Get-Content -LiteralPath $CatalogPath -Raw|ConvertFrom-Json

$DependencyMap=[ordered]@{
    'lead-migration'=@()
    'crm'=@('lead-migration')
    'bcc'=@('crm')
    'education'=@()
    'intake'=@('crm')
    'verify'=@('crm')
}

$Known=@{}
foreach($Package in @($Catalog.packages)){
    $Known[[string]$Package.id]=$true
}

$Results=@()
$Failed=0

foreach($Package in @($Catalog.packages)){
    $Id=[string]$Package.id
    $Dependencies=@($DependencyMap[$Id])
    $Missing=@()

    foreach($Dependency in $Dependencies){
        if(-not $Known.ContainsKey([string]$Dependency)){
            $Missing += [string]$Dependency
        }
    }

    $Passed=($Missing.Count-eq0)
    if(-not $Passed){$Failed++}

    $Results+=[pscustomobject]@{
        packageId=$Id
        dependencies=$Dependencies
        missingDependencies=$Missing
        passed=$Passed
    }

    if($Passed){
        Write-PKGCertPass "$Id dependencies"
    }else{
        Write-PKGCertFail "$Id missing: $($Missing -join ', ')"
    }
}

$Report=[ordered]@{
    release='MOS5-018'
    certification='PKGCERT-006'
    generatedAt=(Get-Date).ToString('o')
    failedCount=$Failed
    passed=($Failed-eq0)
    packages=$Results
}

$Path=Write-PKGCertJson -Data $Report -FileName 'PKGCERT-006-Dependency.json'

if($Failed-gt0){
    Write-PKGCertFail "Dependency certification failed. Report: $Path"
    exit 1
}

Write-PKGCertPass "Dependency certification passed. Report: $Path"
exit 0
