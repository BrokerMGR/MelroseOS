<#
MelroseOS Enterprise
Update Manager Module : UPD-004_UpdateDiscovery
Release: MOS5-019
#>

$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\UpdateManager\Core\UPD-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){Write-Host '[FAIL] UPD-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

Write-UPDHeader 'UPD-004 Update Discovery'

$ScanPath=Join-Path $Global:UPD_REPORTS 'UPD-003-VersionScan.json'
if(!(Test-Path -LiteralPath $ScanPath)){
    Write-UPDFail "Version scan report not found: $ScanPath"
    exit 1
}

$Scan=Get-Content -LiteralPath $ScanPath -Raw|ConvertFrom-Json
$Candidates=@($Scan.packages|Where-Object updateAvailable)

$Registry=Get-UPDRegistry
$Registry.updates=@()

foreach($c in $Candidates){
    $Registry.updates += [pscustomobject]@{
        packageId=[string]$c.packageId
        fromVersion=[string]$c.installedVersion
        toVersion=[string]$c.availableVersion
        channel=[string](Get-UPDConfig)['CHANNEL']
        status='DISCOVERED'
        discoveredAt=(Get-Date).ToString('o')
    }

    Write-UPDInfo "Discovered update: $($c.packageId) $($c.installedVersion) -> $($c.availableVersion)"
}

Save-UPDRegistry $Registry

$Report=[ordered]@{
    release='MOS5-019'
    module='UPD-004'
    generatedAt=(Get-Date).ToString('o')
    discoveredCount=$Candidates.Count
    updates=$Registry.updates
}

$Path=Write-UPDJson -Data $Report -FileName 'UPD-004-Discovery.json'
Write-UPDPass "Update discovery complete. Report: $Path"
exit 0
