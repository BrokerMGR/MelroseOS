<#
MelroseOS Enterprise
Module: PKG-020_PackageManager
Release: MOS5-018
#>
$ErrorActionPreference='Stop'
. 'D:\MelroseOS\GitHub\MelroseOS\PackageManager\Core\PKG-000_Common.ps1'
Write-PKGHeader 'PKG-020 Package Manager'
$registry=Get-PKGRegistry
$config=Get-PKGConfig
$summary=[ordered]@{
 release='MOS5-018'
 module='PKG-020'
 packageCount=@($registry.packages).Count
 safeMode=($config['MODE'])
 autoInstall=$config['AUTO_INSTALL']
 autoUpdate=$config['AUTO_UPDATE']
 autoRemove=$config['AUTO_REMOVE']
 generatedAt=(Get-Date).ToString('o')
}
$f=Write-PKGJson -Data $summary -FileName 'PKG-020-PackageManager.json'
Write-PKGPass "Package Manager initialized. Report: $f"
exit 0
