<#
MelroseOS Enterprise
Update Manager Module : UPD-018_UpdateHistory
Release: MOS5-019
#>

$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\UpdateManager\Core\UPD-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){
    Write-Host '[FAIL] UPD-000_Common.ps1 not found.' -ForegroundColor Red
    exit 1
}
. $Common

Write-UPDHeader 'UPD-018 Update History'

$Registry=Get-UPDRegistry
$HistoryPath=Join-Path $Global:UPD_MANAGER 'Registry\update-history.json'

$Existing=@()
if(Test-Path -LiteralPath $HistoryPath){
    try{
        $Current=Get-Content -LiteralPath $HistoryPath -Raw|ConvertFrom-Json
        $Existing=@($Current.history)
    }catch{
        $Existing=@()
    }
}

$NewRows=@()

foreach($Update in @($Registry.updates)){
    $Row=[pscustomobject]@{
        packageId=[string]$Update.packageId
        fromVersion=[string]$Update.fromVersion
        toVersion=[string]$Update.toVersion
        status=[string]$Update.status
        channel=[string]$Update.channel
        recordedAt=(Get-Date).ToString('o')
    }
    $NewRows += $Row
}

$All=@($Existing)+@($NewRows)

$History=[ordered]@{
    release='MOS5-019'
    generatedAt=(Get-Date).ToString('o')
    history=$All
}

$History|ConvertTo-Json -Depth 30|Set-Content -LiteralPath $HistoryPath -Encoding UTF8

$Report=[ordered]@{
    release='MOS5-019'
    module='UPD-018'
    generatedAt=(Get-Date).ToString('o')
    historyPath=$HistoryPath
    appendedCount=$NewRows.Count
    totalCount=$All.Count
    passed=(Test-Path -LiteralPath $HistoryPath)
}

$Path=Write-UPDJson -Data $Report -FileName 'UPD-018-UpdateHistory.json'

if(-not $Report.passed){
    Write-UPDFail "Update history failed. Report: $Path"
    exit 1
}

Write-UPDPass "Update history recorded. Report: $Path"
exit 0
