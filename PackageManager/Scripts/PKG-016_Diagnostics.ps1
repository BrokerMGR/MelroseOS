<#
MelroseOS Enterprise
Module: PKG-016_Diagnostics
Release: MOS5-018
#>
$ErrorActionPreference='Stop'
. 'D:\MelroseOS\GitHub\MelroseOS\PackageManager\Core\PKG-000_Common.ps1'
Write-PKGHeader 'PKG-016 Diagnostics'
$checks=@(
 $Global:PKG_MANAGER,
 (Join-Path $Global:PKG_MANAGER 'Scripts'),
 (Join-Path $Global:PKG_MANAGER 'Config'),
 (Join-Path $Global:PKG_MANAGER 'Registry'),
 $Global:PKG_CATALOG
)
$result=@()
foreach($c in $checks){
 $ok=Test-Path -LiteralPath $c
 $result+=[pscustomobject]@{path=$c;passed=$ok}
 if($ok){Write-PKGPass $c}else{Write-PKGFail $c}
}
$f=Write-PKGJson -Data $result -FileName 'PKG-016-Diagnostics.json'
Write-PKGPass "Report: $f"
exit 0
