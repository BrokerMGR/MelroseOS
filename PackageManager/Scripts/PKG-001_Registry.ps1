<#
MelroseOS Enterprise
Package Manager Module : PKG-001_Registry
Release: MOS5-018
#>

$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\PackageManager\Core\PKG-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){Write-Host '[FAIL] PKG-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

Write-PKGHeader 'PKG-001 Registry'

$Catalog=if(Test-Path -LiteralPath $Global:PKG_CATALOG){Get-Content -LiteralPath $Global:PKG_CATALOG -Raw|ConvertFrom-Json}else{$null}
$Registry=Get-PKGRegistry

if($null-eq$Catalog){
    Write-PKGFail 'PackageCatalog.json not found.'
    exit 1
}

$Existing=@{}
foreach($p in @($Registry.packages)){$Existing[[string]$p.id]=$p}

$Rows=@()
foreach($pkg in @($Catalog.packages)){
    $current=$Existing[[string]$pkg.id]
    $Rows+=[pscustomobject]@{
        id=[string]$pkg.id
        name=[string]$pkg.name
        source=[string]$pkg.source
        status=if($current){[string]$current.status}else{'DISCOVERED'}
        installedVersion=if($current){[string]$current.installedVersion}else{''}
        availableVersion=if($current){[string]$current.availableVersion}else{''}
        lastUpdated=if($current){[string]$current.lastUpdated}else{''}
    }
}

$NewRegistry=[pscustomobject]@{
    release='MOS5-018'
    generatedAt=(Get-Date).ToString('o')
    packages=$Rows
}

Save-PKGRegistry $NewRegistry
$Path=Write-PKGJson -Data $NewRegistry -FileName 'PKG-001-Registry.json'
Write-PKGPass "Registry synchronized. Report: $Path"
exit 0
