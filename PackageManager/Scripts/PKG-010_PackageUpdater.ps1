<#
MelroseOS Enterprise
Module: PKG-010_PackageUpdater
Release: MOS5-018
#>
$ErrorActionPreference='Stop'
. 'D:\MelroseOS\GitHub\MelroseOS\PackageManager\Core\PKG-000_Common.ps1'
Write-PKGHeader 'PKG-010 Package Updater'
$cfg=Get-PKGConfig
$exec=($cfg['AUTO_UPDATE'] -eq 'TRUE')
$plan=Join-Path $Global:PKG_REPORTS 'PKG-009-UpdatePlan.json'
if(!(Test-Path $plan)){Write-PKGFail 'Update plan missing.';exit 1}
$data=Get-Content $plan -Raw|ConvertFrom-Json
$reg=Get-PKGRegistry
foreach($u in $data.packages){
 if($exec -and $u.updateAvailable){
  $pkg=$reg.packages|Where-Object id -eq $u.packageId
  $pkg.installedVersion=$u.availableVersion
  $pkg.lastUpdated=(Get-Date).ToString('o')
 }
}
if($exec){Save-PKGRegistry $reg}
$f=Write-PKGJson -Data $data -FileName 'PKG-010-UpdateReport.json'
Write-PKGPass "Report: $f"
exit 0
