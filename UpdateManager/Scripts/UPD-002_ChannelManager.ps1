<#
MelroseOS Enterprise
Update Manager Module : UPD-002_ChannelManager
Release: MOS5-019
#>

$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\UpdateManager\Core\UPD-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){Write-Host '[FAIL] UPD-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

Write-UPDHeader 'UPD-002 Channel Manager'

if(!(Test-Path -LiteralPath $Global:UPD_CHANNELS)){
    Write-UPDFail "UpdateChannels.json not found: $Global:UPD_CHANNELS"
    exit 1
}

try{
    $Channels=Get-Content -LiteralPath $Global:UPD_CHANNELS -Raw|ConvertFrom-Json
}catch{
    Write-UPDFail 'UpdateChannels.json is invalid JSON.'
    exit 1
}

$Config=Get-UPDConfig
$Configured=[string]$Config['CHANNEL']
$Known=@($Channels.channels.id)

if($Known -notcontains $Configured){
    Write-UPDFail "Configured channel is not registered: $Configured"
    exit 1
}

$Active=$Channels.channels|Where-Object id -eq $Configured

$Report=[ordered]@{
    release='MOS5-019'
    module='UPD-002'
    generatedAt=(Get-Date).ToString('o')
    configuredChannel=$Configured
    enabled=[bool]$Active.enabled
    defaultChannel=[string]$Channels.defaultChannel
    channels=$Channels.channels
}

$Path=Write-UPDJson -Data $Report -FileName 'UPD-002-Channels.json'
Write-UPDPass "Channel $Configured validated. Report: $Path"
exit 0
