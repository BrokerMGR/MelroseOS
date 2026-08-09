<#
MelroseOS Enterprise
Update Manager Module : UPD-003_VersionScanner
Release: MOS5-019
#>

$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\UpdateManager\Core\UPD-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){Write-Host '[FAIL] UPD-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

Write-UPDHeader 'UPD-003 Version Scanner'

$PackageRegistry='D:\MelroseOS\GitHub\MelroseOS\PackageManager\Registry\packages.json'
if(!(Test-Path -LiteralPath $PackageRegistry)){
    Write-UPDFail "Package registry not found: $PackageRegistry"
    exit 1
}

try{
    $Packages=Get-Content -LiteralPath $PackageRegistry -Raw|ConvertFrom-Json
}catch{
    Write-UPDFail 'Package registry JSON is invalid.'
    exit 1
}

$Rows=@()

foreach($p in @($Packages.packages)){
    $installed=[string]$p.installedVersion
    $available=[string]$p.availableVersion

    if([string]::IsNullOrWhiteSpace($installed)){$installed='0.0.0'}
    if([string]::IsNullOrWhiteSpace($available)){$available='1.0.0'}

    $Rows+=[pscustomobject]@{
        packageId=[string]$p.id
        installedVersion=$installed
        availableVersion=$available
        updateAvailable=($installed -ne $available)
        status=[string]$p.status
    }

    if($installed -ne $available){
        Write-UPDInfo "$($p.id): $installed -> $available"
    }else{
        Write-UPDPass "$($p.id): current"
    }
}

$Report=[ordered]@{
    release='MOS5-019'
    module='UPD-003'
    generatedAt=(Get-Date).ToString('o')
    packageCount=$Rows.Count
    updateCandidateCount=@($Rows|Where-Object updateAvailable).Count
    packages=$Rows
}

$Path=Write-UPDJson -Data $Report -FileName 'UPD-003-VersionScan.json'
Write-UPDPass "Version scan complete. Report: $Path"
exit 0
