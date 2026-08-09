<#
MelroseOS Enterprise
Module: PKG-009_UpdatePlanner
Release: MOS5-018
#>
$ErrorActionPreference='Stop'
. 'D:\MelroseOS\GitHub\MelroseOS\PackageManager\Core\PKG-000_Common.ps1'
Write-PKGHeader 'PKG-009 Update Planner'
$Catalog=Get-Content $Global:PKG_CATALOG -Raw|ConvertFrom-Json
$Registry=Get-PKGRegistry
$rows=@()
foreach($p in $Registry.packages){
 $cat=$Catalog.packages|Where-Object id -eq $p.id
 $avail=if($cat){'1.0.0'}else{$p.availableVersion}
 $rows+=[pscustomobject]@{
  packageId=$p.id
  installedVersion=$p.installedVersion
  availableVersion=$avail
  updateAvailable=($p.installedVersion -ne $avail)
 }
}
$r=[ordered]@{release='MOS5-018';module='PKG-009';generatedAt=(Get-Date).ToString('o');packages=$rows}
$f=Write-PKGJson -Data $r -FileName 'PKG-009-UpdatePlan.json'
Write-PKGPass "Report: $f"
exit 0
