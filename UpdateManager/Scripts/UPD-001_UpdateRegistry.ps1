<#
MelroseOS Enterprise
Update Manager Module : UPD-001_UpdateRegistry
Release: MOS5-019
#>

$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\UpdateManager\Core\UPD-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){Write-Host '[FAIL] UPD-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

Write-UPDHeader 'UPD-001 Update Registry'

$Registry=Get-UPDRegistry
if($null-eq$Registry.updates){
    $Registry|Add-Member -MemberType NoteProperty -Name updates -Value @()
}

Save-UPDRegistry $Registry

$Report=[ordered]@{
    release='MOS5-019'
    module='UPD-001'
    generatedAt=(Get-Date).ToString('o')
    updateCount=@($Registry.updates).Count
    registryPath=$Global:UPD_REGISTRY
}

$Path=Write-UPDJson -Data $Report -FileName 'UPD-001-Registry.json'
Write-UPDPass "Update registry ready. Report: $Path"
exit 0
