<#
MelroseOS Recruiting Automation Platform
Certification Core
Release: MOS5-021
Version: 1.0.0
#>

$ErrorActionPreference='Stop'

$Global:REC_ROOT='D:\MelroseOS\GitHub\MelroseOS\RecruitingEngine'
$Global:REC_CERT=Join-Path $Global:REC_ROOT 'Certification'
$Global:REC_REPORTS=Join-Path $Global:REC_CERT 'Reports'

if(!(Test-Path -LiteralPath $Global:REC_REPORTS)){
    New-Item -ItemType Directory -Force -Path $Global:REC_REPORTS|Out-Null
}

function Write-RECCertHeader([string]$Title){
    Write-Host ''
    Write-Host '=========================================================='
    Write-Host " $Title"
    Write-Host '=========================================================='
    Write-Host ''
}
function Write-RECCertPass([string]$Text){Write-Host "[PASS] $Text" -ForegroundColor Green}
function Write-RECCertFail([string]$Text){Write-Host "[FAIL] $Text" -ForegroundColor Red}
function Write-RECCertWarn([string]$Text){Write-Host "[WARN] $Text" -ForegroundColor Yellow}
function Write-RECCertInfo([string]$Text){Write-Host "[INFO] $Text"}

function Write-RECCertJson {
    param(
        [Parameter(Mandatory=$true)]$Data,
        [Parameter(Mandatory=$true)][string]$FileName
    )
    $Path=Join-Path $Global:REC_REPORTS $FileName
    $Data|ConvertTo-Json -Depth 50|Set-Content -LiteralPath $Path -Encoding UTF8
    return $Path
}

function Get-RECSourceFiles {
    $Path=Join-Path $Global:REC_ROOT 'AppsScript'
    return @(Get-ChildItem -LiteralPath $Path -Filter '*.gs' -File -ErrorAction SilentlyContinue)
}
