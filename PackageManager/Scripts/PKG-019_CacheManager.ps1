<#
MelroseOS Enterprise
Module: PKG-019_CacheManager
Release: MOS5-018
#>
$ErrorActionPreference='Stop'
. 'D:\MelroseOS\GitHub\MelroseOS\PackageManager\Core\PKG-000_Common.ps1'
Write-PKGHeader 'PKG-019 Cache Manager'
$cache=Join-Path $Global:PKG_MANAGER 'Packages\Cache'
if(!(Test-Path $cache)){New-Item -ItemType Directory -Force -Path $cache|Out-Null}
$items=Get-ChildItem $cache -Force -ErrorAction SilentlyContinue
$r=[ordered]@{
 release='MOS5-018'
 module='PKG-019'
 cachePath=$cache
 itemCount=@($items).Count
 generatedAt=(Get-Date).ToString('o')
}
$f=Write-PKGJson -Data $r -FileName 'PKG-019-Cache.json'
Write-PKGPass "Report: $f"
exit 0
