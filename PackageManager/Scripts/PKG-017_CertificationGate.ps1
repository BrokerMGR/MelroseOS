<#
MelroseOS Enterprise
Module: PKG-017_CertificationGate
Release: MOS5-018
#>
$ErrorActionPreference='Stop'
. 'D:\MelroseOS\GitHub\MelroseOS\PackageManager\Core\PKG-000_Common.ps1'
Write-PKGHeader 'PKG-017 Certification Gate'
$cfg=Get-PKGConfig
$r=[ordered]@{
 release='MOS5-018'
 module='PKG-017'
 certificationRequired=($cfg['REQUIRE_CERTIFICATION'] -eq 'TRUE')
 report=(Join-Path $Global:PKG_ROOT 'tools\LeadMigration\Certification\Reports\CERT-015-Final.json')
 generatedAt=(Get-Date).ToString('o')
}
$f=Write-PKGJson -Data $r -FileName 'PKG-017-CertificationGate.json'
Write-PKGPass "Report: $f"
exit 0
