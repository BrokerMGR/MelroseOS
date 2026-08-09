<#
==========================================================
MelroseOS Enterprise
Module : LM-001
Name   : Enterprise Core
Version: 1.0.0
Release: MOS5-016
==========================================================
#>

$ErrorActionPreference = 'Stop'

#----------------------------------------------------------
# Load Common Library
#----------------------------------------------------------

$CommonModule = Join-Path (Split-Path $PSScriptRoot -Parent) `
    "tools\LeadMigration\Active\LM-000_Common.ps1"

if (Test-Path $CommonModule) {
    . $CommonModule
}
else {
    Write-Host "LM-000_Common.ps1 not found." -ForegroundColor Red
    exit 1
}

#----------------------------------------------------------
# Global Configuration
#----------------------------------------------------------

$Global:MOS = @{

    Release = "MOS5-016"

    Version = "1.0.0"

    Root = Get-MOSRoot

    LeadMigration = Get-MOSLeadMigrationRoot

}

#----------------------------------------------------------
# Enterprise Banner
#----------------------------------------------------------

function Show-MOSEnterpriseBanner {

    Write-MOSHeader "Enterprise Core"

    Write-Host "Release : $($Global:MOS.Release)"
    Write-Host "Version : $($Global:MOS.Version)"
    Write-Host "Root    : $($Global:MOS.Root)"

    Write-Host ""

}

#----------------------------------------------------------
# Enterprise Health
#----------------------------------------------------------

function Test-MOSEnvironment {

    Write-MOSInfo "Running Enterprise Diagnostics..."

    $Folders = @(
        "$($Global:MOS.LeadMigration)\Active",
        "$($Global:MOS.LeadMigration)\Archive",
        "$($Global:MOS.LeadMigration)\Config",
        "$($Global:MOS.LeadMigration)\Reports",
        "$($Global:MOS.LeadMigration)\Logs",
        "$($Global:MOS.LeadMigration)\Tests",
        "$($Global:MOS.LeadMigration)\Installers"
    )

    foreach($Folder in $Folders){

        if(Test-Path $Folder){

            Write-MOSSuccess $Folder

        }
        else{

            Write-MOSError $Folder

        }

    }

}

#----------------------------------------------------------
# Startup
#----------------------------------------------------------

Show-MOSEnterpriseBanner

Test-MOSEnvironment

Write-MOSLog "Enterprise Core Loaded"

Write-MOSSuccess "LM-001 Enterprise Core Ready"