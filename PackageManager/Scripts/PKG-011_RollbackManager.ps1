<#
MelroseOS Enterprise
Module: PKG-011_RollbackManager
Release: MOS5-018
#>
$ErrorActionPreference='Stop'
. 'D:\MelroseOS\GitHub\MelroseOS\PackageManager\Core\PKG-000_Common.ps1'
Write-PKGHeader 'PKG-011 Rollback Manager'
$cfg=Get-PKGConfig
$r=[ordered]@{
 release='MOS5-018'
 module='PKG-011'
 generatedAt=(Get-Date).ToString('o')
 rollbackEnabled=($cfg['ALLOW_ROLLBACK'] -eq 'TRUE')
 snapshotRequired=($cfg['REQUIRE_SNAPSHOT'] -eq 'TRUE')
 previewOnly=$true
}
$f=Write-PKGJson -Data $r -FileName 'PKG-011-Rollback.json'
Write-PKGPass "Report: $f"
exit 0
