<#
MelroseOS Enterprise
Update Manager Module : UPD-011_UpdateInstaller
Release: MOS5-019
#>

$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\UpdateManager\Core\UPD-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){
    Write-Host '[FAIL] UPD-000_Common.ps1 not found.' -ForegroundColor Red
    exit 1
}
. $Common

Write-UPDHeader 'UPD-011 Update Installer'

$Config=Get-UPDConfig
$AutoInstall=([string]$Config['AUTO_INSTALL'] -eq 'TRUE')
$StageReport=Join-Path $Global:UPD_REPORTS 'UPD-009-Staging.json'
$SnapshotReport=Join-Path $Global:UPD_REPORTS 'UPD-010-PreUpdateSnapshot.json'

if(!(Test-Path -LiteralPath $StageReport)){
    Write-UPDFail "Staging report not found: $StageReport"
    exit 1
}
if(!(Test-Path -LiteralPath $SnapshotReport)){
    Write-UPDFail "Snapshot report not found: $SnapshotReport"
    exit 1
}

$Stage=Get-Content -LiteralPath $StageReport -Raw|ConvertFrom-Json
$Snapshot=Get-Content -LiteralPath $SnapshotReport -Raw|ConvertFrom-Json

if(-not [bool]$Stage.passed){
    Write-UPDFail 'Staging did not pass. Installation blocked.'
    exit 1
}
if(-not [bool]$Snapshot.passed){
    Write-UPDFail 'Pre-update snapshot did not pass. Installation blocked.'
    exit 1
}

$Registry=Get-UPDRegistry
$Results=@()
$Failed=0

foreach($Item in @($Stage.results)){
    $Id=[string]$Item.packageId
    $Result='INSTALL_BLOCKED_BY_SAFE_MODE'
    $Passed=$true

    if($AutoInstall){
        try{
            $RegistryItem=$Registry.updates|Where-Object packageId -eq $Id|Select-Object -First 1
            if($RegistryItem){
                $RegistryItem.status='INSTALLED'
                $RegistryItem|Add-Member -NotePropertyName installedAt -NotePropertyValue (Get-Date).ToString('o') -Force
                $Result='INSTALLED'
            }else{
                throw "Update registry entry missing for $Id"
            }
        }catch{
            $Passed=$false
            $Failed++
            $Result=$_.Exception.Message
        }
    }

    $Results += [pscustomobject]@{
        packageId=$Id
        autoInstall=$AutoInstall
        result=$Result
        passed=$Passed
    }

    if($Passed){Write-UPDPass "$Id : $Result"}else{Write-UPDFail "$Id : $Result"}
}

if($AutoInstall){
    Save-UPDRegistry $Registry
}

$Report=[ordered]@{
    release='MOS5-019'
    module='UPD-011'
    generatedAt=(Get-Date).ToString('o')
    autoInstall=$AutoInstall
    safeMode=([string]$Config['MODE'])
    failedCount=$Failed
    passed=($Failed-eq0)
    results=$Results
}

$Path=Write-UPDJson -Data $Report -FileName 'UPD-011-UpdateInstaller.json'
if($Failed-gt0){
    Write-UPDFail "Update installation failed. Report: $Path"
    exit 1
}

Write-UPDPass "Update Installer completed. Report: $Path"
exit 0
