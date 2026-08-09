<#
MelroseOS Enterprise
Module: PKG-013_PackageSnapshot
Release: MOS5-018
#>
$ErrorActionPreference='Stop'
. 'D:\MelroseOS\GitHub\MelroseOS\PackageManager\Core\PKG-000_Common.ps1'
Write-PKGHeader 'PKG-013 Package Snapshot'
$reg=Get-PKGRegistry
$dir=Join-Path $Global:PKG_MANAGER 'Snapshots'
if(!(Test-Path $dir)){New-Item -ItemType Directory -Force -Path $dir|Out-Null}
$name='Snapshot-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.json'
$path=Join-Path $dir $name
$reg|ConvertTo-Json -Depth 30|Set-Content $path -Encoding UTF8
$r=[ordered]@{release='MOS5-018';module='PKG-013';snapshot=$path;generatedAt=(Get-Date).ToString('o')}
$f=Write-PKGJson -Data $r -FileName 'PKG-013-Snapshot.json'
Write-PKGPass "Report: $f"
exit 0
