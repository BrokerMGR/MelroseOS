<#
MelroseOS Enterprise
Module: PKG-015_PackageReporter
Release: MOS5-018
#>
$ErrorActionPreference='Stop'
. 'D:\MelroseOS\GitHub\MelroseOS\PackageManager\Core\PKG-000_Common.ps1'
Write-PKGHeader 'PKG-015 Package Reporter'
$reg=Get-PKGRegistry
$report=[ordered]@{
 release='MOS5-018'
 module='PKG-015'
 generatedAt=(Get-Date).ToString('o')
 packageCount=@($reg.packages).Count
 installedCount=@($reg.packages|Where-Object status -eq 'INSTALLED').Count
 packages=$reg.packages
}
$f=Write-PKGJson -Data $report -FileName 'PKG-015-PackageReport.json'
Write-PKGPass "Report: $f"
exit 0
