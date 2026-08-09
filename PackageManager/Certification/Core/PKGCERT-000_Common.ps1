<#
MelroseOS Enterprise
Package Manager Certification Core
Module : PKGCERT-000_Common
Release: MOS5-018
#>

$ErrorActionPreference='Stop'

$Global:PKGCERT_ROOT='D:\MelroseOS\GitHub\MelroseOS'
$Global:PKGCERT_PACKAGE=Join-Path $Global:PKGCERT_ROOT 'PackageManager'
$Global:PKGCERT_FRAMEWORK=Join-Path $Global:PKGCERT_PACKAGE 'Certification'
$Global:PKGCERT_REPORTS=Join-Path $Global:PKGCERT_FRAMEWORK 'Reports'
$Global:PKGCERT_LOGS=Join-Path $Global:PKGCERT_FRAMEWORK 'Logs'
$Global:PKGCERT_SCRIPTS=Join-Path $Global:PKGCERT_FRAMEWORK 'Scripts'

function Initialize-PackageCertification {
    foreach($p in @(
        $Global:PKGCERT_FRAMEWORK,
        $Global:PKGCERT_REPORTS,
        $Global:PKGCERT_LOGS,
        $Global:PKGCERT_SCRIPTS
    )){
        if(!(Test-Path -LiteralPath $p)){
            New-Item -ItemType Directory -Force -Path $p|Out-Null
        }
    }
}

function Write-PKGCertHeader {
    param([string]$Title)
    Write-Host ''
    Write-Host '=========================================================='
    Write-Host ' MelroseOS Package Manager Certification'
    Write-Host " $Title"
    Write-Host '=========================================================='
    Write-Host ''
}

function Write-PKGCertPass { param([string]$Message) Write-Host "[PASS] $Message" -ForegroundColor Green }
function Write-PKGCertFail { param([string]$Message) Write-Host "[FAIL] $Message" -ForegroundColor Red }
function Write-PKGCertWarn { param([string]$Message) Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Write-PKGCertInfo { param([string]$Message) Write-Host "[INFO] $Message" }

function Write-PKGCertJson {
    param(
        [Parameter(Mandatory)]$Data,
        [Parameter(Mandatory)][string]$FileName,
        [int]$Depth=40
    )
    Initialize-PackageCertification
    $Path=Join-Path $Global:PKGCERT_REPORTS $FileName
    $Data|ConvertTo-Json -Depth $Depth|Set-Content -LiteralPath $Path -Encoding UTF8
    return $Path
}

function Get-PKGCertModuleInventory {
    $Rows=@()

    $Core=Join-Path $Global:PKGCERT_PACKAGE 'Core\PKG-000_Common.ps1'
    $Rows += [pscustomobject]@{
        Number=0
        Name='PKG-000_Common.ps1'
        Path=$Core
    }

    $Scripts=Join-Path $Global:PKGCERT_PACKAGE 'Scripts'
    for($i=1;$i -le 20;$i++){
        $Prefix='PKG-{0:D3}_' -f $i
        $Match=Get-ChildItem -LiteralPath $Scripts -Filter "$Prefix*.ps1" -File -ErrorAction SilentlyContinue|Select-Object -First 1

        $Rows += [pscustomobject]@{
            Number=$i
            Name=if($Match){$Match.Name}else{"$Prefix*.ps1"}
            Path=if($Match){$Match.FullName}else{''}
        }
    }

    return $Rows
}

Initialize-PackageCertification
