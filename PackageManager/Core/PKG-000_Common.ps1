<#
MelroseOS Enterprise
Package Manager Core
Module : PKG-000_Common
Release: MOS5-018
#>

$ErrorActionPreference='Stop'

$Global:PKG_ROOT='D:\MelroseOS\GitHub\MelroseOS'
$Global:PKG_MANAGER=Join-Path $Global:PKG_ROOT 'PackageManager'
$Global:PKG_REPORTS=Join-Path $Global:PKG_MANAGER 'Reports'
$Global:PKG_LOGS=Join-Path $Global:PKG_MANAGER 'Logs'
$Global:PKG_REGISTRY=Join-Path $Global:PKG_MANAGER 'Registry\packages.json'
$Global:PKG_CATALOG=Join-Path $Global:PKG_MANAGER 'Manifests\PackageCatalog.json'

function Initialize-PackageManagerFolders {
    foreach($p in @($Global:PKG_MANAGER,$Global:PKG_REPORTS,$Global:PKG_LOGS)){
        if(!(Test-Path -LiteralPath $p)){
            New-Item -ItemType Directory -Force -Path $p|Out-Null
        }
    }
}

function Write-PKGHeader {
    param([string]$Title)
    Write-Host ''
    Write-Host '=========================================================='
    Write-Host ' MelroseOS Enterprise Package Manager'
    Write-Host " $Title"
    Write-Host '=========================================================='
    Write-Host ''
}

function Write-PKGPass { param([string]$Message) Write-Host "[PASS] $Message" -ForegroundColor Green }
function Write-PKGFail { param([string]$Message) Write-Host "[FAIL] $Message" -ForegroundColor Red }
function Write-PKGWarn { param([string]$Message) Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Write-PKGInfo { param([string]$Message) Write-Host "[INFO] $Message" }

function Write-PKGJson {
    param(
        [Parameter(Mandatory)]$Data,
        [Parameter(Mandatory)][string]$FileName,
        [int]$Depth=40
    )
    Initialize-PackageManagerFolders
    $Path=Join-Path $Global:PKG_REPORTS $FileName
    $Data|ConvertTo-Json -Depth $Depth|Set-Content -LiteralPath $Path -Encoding UTF8
    return $Path
}

function Get-PKGConfig {
    $Path=Join-Path $Global:PKG_MANAGER 'Config\PackageManager.config'
    $Config=@{}
    if(Test-Path -LiteralPath $Path){
        foreach($line in Get-Content -LiteralPath $Path){
            if($line -match '^\s*#' -or [string]::IsNullOrWhiteSpace($line)){continue}
            if($line -match '^\s*([^=]+?)\s*=(.*)$'){
                $Config[$Matches[1].Trim()]=$Matches[2].Trim()
            }
        }
    }
    return $Config
}

function Get-PKGRegistry {
    if(!(Test-Path -LiteralPath $Global:PKG_REGISTRY)){
        return [pscustomobject]@{release='MOS5-018';generatedAt='';packages=@()}
    }
    return Get-Content -LiteralPath $Global:PKG_REGISTRY -Raw|ConvertFrom-Json
}

function Save-PKGRegistry {
    param($Registry)
    $Registry.generatedAt=(Get-Date).ToString('o')
    $Registry|ConvertTo-Json -Depth 30|Set-Content -LiteralPath $Global:PKG_REGISTRY -Encoding UTF8
}

Initialize-PackageManagerFolders
