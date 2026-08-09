<#
MelroseOS Enterprise
Update Manager Core
Module : UPD-000_Common
Release: MOS5-019
#>

$ErrorActionPreference='Stop'

$Global:UPD_ROOT='D:\MelroseOS\GitHub\MelroseOS'
$Global:UPD_MANAGER=Join-Path $Global:UPD_ROOT 'UpdateManager'
$Global:UPD_REPORTS=Join-Path $Global:UPD_MANAGER 'Reports'
$Global:UPD_LOGS=Join-Path $Global:UPD_MANAGER 'Logs'
$Global:UPD_CONFIG=Join-Path $Global:UPD_MANAGER 'Config\UpdateManager.config'
$Global:UPD_REGISTRY=Join-Path $Global:UPD_MANAGER 'Registry\updates.json'
$Global:UPD_CHANNELS=Join-Path $Global:UPD_MANAGER 'Channels\UpdateChannels.json'

function Initialize-UpdateManagerFolders {
    foreach($p in @($Global:UPD_MANAGER,$Global:UPD_REPORTS,$Global:UPD_LOGS)){
        if(!(Test-Path -LiteralPath $p)){
            New-Item -ItemType Directory -Force -Path $p|Out-Null
        }
    }
}

function Write-UPDHeader {
    param([string]$Title)
    Write-Host ''
    Write-Host '=========================================================='
    Write-Host ' MelroseOS Enterprise Update Manager'
    Write-Host " $Title"
    Write-Host '=========================================================='
    Write-Host ''
}

function Write-UPDPass { param([string]$Message) Write-Host "[PASS] $Message" -ForegroundColor Green }
function Write-UPDFail { param([string]$Message) Write-Host "[FAIL] $Message" -ForegroundColor Red }
function Write-UPDWarn { param([string]$Message) Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Write-UPDInfo { param([string]$Message) Write-Host "[INFO] $Message" }

function Write-UPDJson {
    param(
        [Parameter(Mandatory)]$Data,
        [Parameter(Mandatory)][string]$FileName,
        [int]$Depth=40
    )

    Initialize-UpdateManagerFolders
    $Path=Join-Path $Global:UPD_REPORTS $FileName
    $Data|ConvertTo-Json -Depth $Depth|Set-Content -LiteralPath $Path -Encoding UTF8
    return $Path
}

function Get-UPDConfig {
    $Config=@{}
    if(Test-Path -LiteralPath $Global:UPD_CONFIG){
        foreach($line in Get-Content -LiteralPath $Global:UPD_CONFIG){
            if($line -match '^\s*#' -or [string]::IsNullOrWhiteSpace($line)){continue}
            if($line -match '^\s*([^=]+?)\s*=(.*)$'){
                $Config[$Matches[1].Trim()]=$Matches[2].Trim()
            }
        }
    }
    return $Config
}

function Get-UPDRegistry {
    if(!(Test-Path -LiteralPath $Global:UPD_REGISTRY)){
        return [pscustomobject]@{release='MOS5-019';generatedAt='';updates=@()}
    }
    return Get-Content -LiteralPath $Global:UPD_REGISTRY -Raw|ConvertFrom-Json
}

function Save-UPDRegistry {
    param($Registry)
    $Registry.generatedAt=(Get-Date).ToString('o')
    $Registry|ConvertTo-Json -Depth 30|Set-Content -LiteralPath $Global:UPD_REGISTRY -Encoding UTF8
}

Initialize-UpdateManagerFolders
