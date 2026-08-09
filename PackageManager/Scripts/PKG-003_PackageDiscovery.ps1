<#
MelroseOS Enterprise
Package Manager Module : PKG-003_PackageDiscovery
Release: MOS5-018
#>

$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\PackageManager\Core\PKG-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){Write-Host '[FAIL] PKG-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

Write-PKGHeader 'PKG-003 Package Discovery'

$Catalog=Get-Content -LiteralPath $Global:PKG_CATALOG -Raw|ConvertFrom-Json
$Rows=@()

foreach($pkg in @($Catalog.packages)){
    $source=Join-Path $Global:PKG_ROOT ([string]$pkg.source)
    $exists=Test-Path -LiteralPath $source
    $fileCount=0
    $bytes=0

    if($exists){
        $files=@(Get-ChildItem -LiteralPath $source -File -Recurse -ErrorAction SilentlyContinue)
        $fileCount=$files.Count
        if($files.Count -gt 0){
            $bytes=($files|Measure-Object Length -Sum).Sum
        }
    }

    $Rows+=[pscustomobject]@{
        id=[string]$pkg.id
        name=[string]$pkg.name
        sourcePath=$source
        exists=$exists
        fileCount=$fileCount
        sizeBytes=[int64]$bytes
        discoveredAt=(Get-Date).ToString('o')
    }

    if($exists){Write-PKGPass "$($pkg.id): $fileCount file(s)"}else{Write-PKGWarn "$($pkg.id): source not found"}
}

$Report=[ordered]@{
    release='MOS5-018'
    module='PKG-003'
    generatedAt=(Get-Date).ToString('o')
    packageCount=$Rows.Count
    packages=$Rows
}
$Path=Write-PKGJson -Data $Report -FileName 'PKG-003-Discovery.json'
Write-PKGPass "Package discovery complete. Report: $Path"
exit 0
