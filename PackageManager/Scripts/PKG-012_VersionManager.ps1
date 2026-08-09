<#
MelroseOS Enterprise
Module: PKG-012_VersionManager
Release: MOS5-018
#>
$ErrorActionPreference='Stop'
. 'D:\MelroseOS\GitHub\MelroseOS\PackageManager\Core\PKG-000_Common.ps1'
Write-PKGHeader 'PKG-012 Version Manager'
$reg=Get-PKGRegistry
foreach($p in $reg.packages){
 if([string]::IsNullOrWhiteSpace($p.installedVersion)){$p.installedVersion='0.0.0'}
 if([string]::IsNullOrWhiteSpace($p.availableVersion)){$p.availableVersion='1.0.0'}
}
Save-PKGRegistry $reg
$f=Write-PKGJson -Data $reg -FileName 'PKG-012-Versions.json'
Write-PKGPass "Report: $f"
exit 0
