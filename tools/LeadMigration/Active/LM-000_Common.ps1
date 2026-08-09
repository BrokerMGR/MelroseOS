<#
==========================================================
MelroseOS Enterprise
Module : LM-000
Name   : Common Library
Version: 1.0.0
==========================================================
#>

$ErrorActionPreference = 'Stop'

$Global:MOSRelease = 'MOS5-016'
$Global:MOSVersion = '1.0.0'

function Write-MOSHeader {

    param([string]$Title)

    Write-Host ""
    Write-Host "====================================================="
    Write-Host " MelroseOS Enterprise"
    Write-Host " $Title"
    Write-Host "====================================================="
    Write-Host ""

}

function Write-MOSInfo {

    param([string]$Message)

    Write-Host "[INFO] $Message"

}

function Write-MOSSuccess {

    param([string]$Message)

    Write-Host "[PASS] $Message" -ForegroundColor Green

}

function Write-MOSWarning {

    param([string]$Message)

    Write-Host "[WARN] $Message" -ForegroundColor Yellow

}

function Write-MOSError {

    param([string]$Message)

    Write-Host "[FAIL] $Message" -ForegroundColor Red

}

function Test-MOSFolder {

    param([string]$Folder)

    if(!(Test-Path $Folder))
    {
        New-Item -ItemType Directory -Force -Path $Folder | Out-Null
    }

    return $true

}

function Get-MOSTimeStamp {

    return (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")

}

function Get-MOSRoot {

    return "D:\MelroseOS\GitHub\MelroseOS"

}

function Get-MOSLeadMigrationRoot {

    return "$(Get-MOSRoot)\tools\LeadMigration"

}

function Write-MOSLog {

    param(

        [string]$Message,
        [string]$LogName="Developer"

    )

    $Root=Get-MOSLeadMigrationRoot

    Test-MOSFolder "$Root\Logs"

    $Log="$Root\Logs\$LogName.log"

    "$(Get-MOSTimeStamp) | $Message" |
        Out-File $Log -Append -Encoding utf8

}

Export-ModuleMember -Function *