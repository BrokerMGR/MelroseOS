<#
MelroseOS Enterprise
Package Manager Module : PKG-002_ManifestReader
Release: MOS5-018
#>

$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\PackageManager\Core\PKG-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){Write-Host '[FAIL] PKG-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

Write-PKGHeader 'PKG-002 Manifest Reader'

if(!(Test-Path -LiteralPath $Global:PKG_CATALOG)){
    Write-PKGFail "Catalog not found: $Global:PKG_CATALOG"
    exit 1
}

try{
    $Catalog=Get-Content -LiteralPath $Global:PKG_CATALOG -Raw|ConvertFrom-Json
}catch{
    Write-PKGFail 'PackageCatalog.json is invalid JSON.'
    exit 1
}

$Results=@()
foreach($pkg in @($Catalog.packages)){
    $source=Join-Path $Global:PKG_ROOT ([string]$pkg.source)
    $exists=Test-Path -LiteralPath $source
    $Results+=[pscustomobject]@{
        id=[string]$pkg.id
        name=[string]$pkg.name
        source=[string]$pkg.source
        sourcePath=$source
        sourceExists=$exists
        declaredStatus=[string]$pkg.status
    }
    if($exists){Write-PKGPass "$($pkg.id) -> $source"}else{Write-PKGWarn "$($pkg.id) source missing: $source"}
}

$Report=[ordered]@{
    release='MOS5-018'
    module='PKG-002'
    generatedAt=(Get-Date).ToString('o')
    packageCount=$Results.Count
    packages=$Results
}
$Path=Write-PKGJson -Data $Report -FileName 'PKG-002-Manifests.json'
Write-PKGPass "Manifest read complete. Report: $Path"
exit 0
