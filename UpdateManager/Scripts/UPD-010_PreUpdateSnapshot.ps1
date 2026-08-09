<#
MelroseOS Enterprise
Update Manager Module : UPD-010_PreUpdateSnapshot
Release: MOS5-019
#>

$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\UpdateManager\Core\UPD-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){
    Write-Host '[FAIL] UPD-000_Common.ps1 not found.' -ForegroundColor Red
    exit 1
}
. $Common

Write-UPDHeader 'UPD-010 Pre-Update Snapshot'

$RegistryPath='D:\MelroseOS\GitHub\MelroseOS\PackageManager\Registry\packages.json'
if(!(Test-Path -LiteralPath $RegistryPath)){
    Write-UPDFail "Package registry not found: $RegistryPath"
    exit 1
}

$SnapshotRoot=Join-Path $Global:UPD_MANAGER 'Snapshots'
if(!(Test-Path -LiteralPath $SnapshotRoot)){
    New-Item -ItemType Directory -Force -Path $SnapshotRoot|Out-Null
}

try{
    $Registry=Get-Content -LiteralPath $RegistryPath -Raw|ConvertFrom-Json
}catch{
    Write-UPDFail 'Package registry JSON is invalid.'
    exit 1
}

$Stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$SnapshotPath=Join-Path $SnapshotRoot "PreUpdate-$Stamp.json"

$Snapshot=[ordered]@{
    release='MOS5-019'
    module='UPD-010'
    generatedAt=(Get-Date).ToString('o')
    sourceRegistry=$RegistryPath
    registry=$Registry
}

$Snapshot|ConvertTo-Json -Depth 40|Set-Content -LiteralPath $SnapshotPath -Encoding UTF8

$Report=[ordered]@{
    release='MOS5-019'
    module='UPD-010'
    generatedAt=(Get-Date).ToString('o')
    snapshotPath=$SnapshotPath
    packageCount=@($Registry.packages).Count
    passed=(Test-Path -LiteralPath $SnapshotPath)
}

$Path=Write-UPDJson -Data $Report -FileName 'UPD-010-PreUpdateSnapshot.json'

if(-not $Report.passed){
    Write-UPDFail "Snapshot creation failed. Report: $Path"
    exit 1
}

Write-UPDPass "Pre-update snapshot created. Report: $Path"
exit 0
