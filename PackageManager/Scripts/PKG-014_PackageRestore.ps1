<#
MelroseOS Enterprise
Module: PKG-014_PackageRestore
Release: MOS5-018
#>
$ErrorActionPreference='Stop'
. 'D:\MelroseOS\GitHub\MelroseOS\PackageManager\Core\PKG-000_Common.ps1'
Write-PKGHeader 'PKG-014 Package Restore'
$dir=Join-Path $Global:PKG_MANAGER 'Snapshots'
$latest=Get-ChildItem $dir -Filter *.json -ErrorAction SilentlyContinue|Sort-Object LastWriteTime -Descending|Select-Object -First 1
$status='NO_SNAPSHOT'
if($latest){$status='READY';$snapshot=$latest.FullName}else{$snapshot=''}
$r=[ordered]@{release='MOS5-018';module='PKG-014';status=$status;snapshot=$snapshot;previewOnly=$true}
$f=Write-PKGJson -Data $r -FileName 'PKG-014-Restore.json'
Write-PKGPass "Report: $f"
exit 0
