<#
==========================================================
MelroseOS Enterprise
Module : LM-001
Name   : Enterprise Core
Version: 1.0.1
Release: MOS5-016
==========================================================
#>

$ErrorActionPreference = 'Stop'

$RepositoryRoot = 'D:\MelroseOS\GitHub\MelroseOS'
$CommonModule   = Join-Path $RepositoryRoot 'CoreModules\LM-000_Common.ps1'

if (-not (Test-Path -LiteralPath $CommonModule)) {
    Write-Host "[FAIL] LM-000_Common.ps1 not found:" -ForegroundColor Red
    Write-Host $CommonModule -ForegroundColor Red
    exit 1
}

. $CommonModule

$Global:MOS = @{
    Release       = 'MOS5-016'
    Version       = '1.0.1'
    Root          = $RepositoryRoot
    LeadMigration = Get-MOSLeadMigrationRoot
}

function Show-MOSEnterpriseBanner {
    Write-MOSHeader 'Enterprise Core'
    Write-Host "Release : $($Global:MOS.Release)"
    Write-Host "Version : $($Global:MOS.Version)"
    Write-Host "Root    : $($Global:MOS.Root)"
    Write-Host ""
}

function Test-MOSEnvironment {
    Write-MOSInfo 'Running Enterprise Diagnostics...'

    $Folders = @(
        "$($Global:MOS.LeadMigration)\Active",
        "$($Global:MOS.LeadMigration)\Archive",
        "$($Global:MOS.LeadMigration)\Config",
        "$($Global:MOS.LeadMigration)\Reports",
        "$($Global:MOS.LeadMigration)\Logs",
        "$($Global:MOS.LeadMigration)\Tests",
        "$($Global:MOS.LeadMigration)\Installers"
    )

    $Failed = 0

    foreach ($Folder in $Folders) {
        if (Test-Path -LiteralPath $Folder) {
            Write-MOSSuccess $Folder
        }
        else {
            Write-MOSError $Folder
            $Failed++
        }
    }

    return ($Failed -eq 0)
}

Show-MOSEnterpriseBanner

if (-not (Test-MOSEnvironment)) {
    Write-MOSError 'LM-001 environment validation failed.'
    exit 1
}

Write-MOSLog -Message 'Enterprise Core Loaded' -LogName 'LeadMigration'
Write-MOSSuccess 'LM-001 Enterprise Core Ready'

exit 0
