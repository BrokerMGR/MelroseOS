$ErrorActionPreference = "Stop"

$Repo = (Resolve-Path "$PSScriptRoot\..\..\..").Path
$ProjectsRoot = Join-Path $Repo "PROJECTS"
$ReportRoot = Join-Path $PSScriptRoot "reports"

if (!(Test-Path $ReportRoot)) {
    New-Item -ItemType Directory -Path $ReportRoot | Out-Null
}

$Results = @()

Get-ChildItem $ProjectsRoot -Directory | ForEach-Object {

    $Project = $_.Name

    $Clasp = Join-Path $_.FullName ".clasp.json"

    if(!(Test-Path $Clasp)){
        return
    }

    $Config = Get-Content $Clasp -Raw | ConvertFrom-Json

    $Results += [pscustomobject]@{

        Project = $Project

        ScriptId = $Config.scriptId

        InstallStatus = "READY"

        TriggerStatus = "NOT_INSTALLED"

    }

}

$Results |
Export-Csv `
(Join-Path $ReportRoot "TriggerInstaller.csv") `
-NoTypeInformation

$Results |
Format-Table -AutoSize

Write-Host ""
Write-Host "[PASS]"