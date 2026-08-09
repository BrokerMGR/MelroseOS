<#
MelroseOS Enterprise
Module: PKG-018_ReleaseManager
Release: MOS5-018
#>
$ErrorActionPreference='Stop'
. 'D:\MelroseOS\GitHub\MelroseOS\PackageManager\Core\PKG-000_Common.ps1'
Write-PKGHeader 'PKG-018 Release Manager'
$reg=Get-PKGRegistry
$data=[ordered]@{
 release='MOS5-018'
 module='PKG-018'
 packageCount=@($reg.packages).Count
 generatedAt=(Get-Date).ToString('o')
}
$f=Write-PKGJson -Data $data -FileName 'PKG-018-Release.json'
Write-PKGPass "Report: $f"
exit 0
