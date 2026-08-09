<#
==========================================================
MelroseOS Enterprise
Module : LM-000
Name   : Common Library
Version: 1.0.1
Release: MOS5-016
==========================================================
#>

$ErrorActionPreference = 'Stop'

$Global:MOSRelease = 'MOS5-016'
$Global:MOSVersion = '1.0.1'

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

    if (-not (Test-Path -LiteralPath $Folder)) {
        New-Item -ItemType Directory -Force -Path $Folder | Out-Null
    }

    return (Test-Path -LiteralPath $Folder)
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
        [string]$LogName = "Developer"
    )

    $Root = Get-MOSLeadMigrationRoot
    $LogFolder = Join-Path $Root "Logs"

    Test-MOSFolder $LogFolder | Out-Null

    $Log = Join-Path $LogFolder "$LogName.log"

    "$(Get-MOSTimeStamp) | $Message" |
        Out-File -LiteralPath $Log -Append -Encoding utf8
}

# Intentionally no Export-ModuleMember here.
# LM-000_Common.ps1 is dot-sourced by the LM scripts rather than imported as a .psm1 module.
