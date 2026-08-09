<#
MelroseOS Enterprise
Certification Framework
Core : CERT-000_Common
Release: MOS5-017A
#>

$ErrorActionPreference = 'Stop'

$Global:CERT_ROOT = 'D:\MelroseOS\GitHub\MelroseOS'
$Global:CERT_FRAMEWORK = Join-Path $Global:CERT_ROOT 'tools\LeadMigration\Certification'
$Global:CERT_REPORTS = Join-Path $Global:CERT_FRAMEWORK 'Reports'
$Global:CERT_LOGS = Join-Path $Global:CERT_FRAMEWORK 'Logs'

function Initialize-CertificationFolders {
    foreach ($Path in @($Global:CERT_FRAMEWORK,$Global:CERT_REPORTS,$Global:CERT_LOGS)) {
        if (-not (Test-Path -LiteralPath $Path)) {
            New-Item -ItemType Directory -Force -Path $Path | Out-Null
        }
    }
}

function Write-CertHeader {
    param([string]$Title)
    Write-Host ''
    Write-Host '=========================================================='
    Write-Host ' MelroseOS Certification Framework'
    Write-Host " $Title"
    Write-Host '=========================================================='
    Write-Host ''
}

function Write-CertPass {
    param([string]$Message)
    Write-Host "[PASS] $Message" -ForegroundColor Green
}

function Write-CertFail {
    param([string]$Message)
    Write-Host "[FAIL] $Message" -ForegroundColor Red
}

function Write-CertWarn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-CertInfo {
    param([string]$Message)
    Write-Host "[INFO] $Message"
}

function Write-CertJson {
    param(
        [Parameter(Mandatory)]$Data,
        [Parameter(Mandatory)][string]$FileName,
        [int]$Depth = 40
    )

    Initialize-CertificationFolders
    $Path = Join-Path $Global:CERT_REPORTS $FileName
    $Data | ConvertTo-Json -Depth $Depth | Set-Content -LiteralPath $Path -Encoding UTF8
    return $Path
}

function New-CertResult {
    param(
        [string]$Check,
        [bool]$Passed,
        [string]$Details = ''
    )

    [pscustomobject]@{
        Check = $Check
        Passed = $Passed
        Details = $Details
    }
}

function Get-CertModuleInventory {
    $Dev = Join-Path $Global:CERT_ROOT 'Development'
    $Rows = @()

    $Rows += [pscustomobject]@{
        Number = 0
        Name = 'LM-000_Common.ps1'
        Path = Join-Path $Global:CERT_ROOT 'CoreModules\LM-000_Common.ps1'
    }

    for ($i = 1; $i -le 30; $i++) {
        $Prefix = 'LM-{0:D3}_' -f $i
        $Match = Get-ChildItem -LiteralPath $Dev -Filter "$Prefix*.ps1" -File -ErrorAction SilentlyContinue | Select-Object -First 1

        $Rows += [pscustomobject]@{
            Number = $i
            Name = if ($Match) { $Match.Name } else { "$Prefix*.ps1" }
            Path = if ($Match) { $Match.FullName } else { '' }
        }
    }

    return $Rows
}

Initialize-CertificationFolders
