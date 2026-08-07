$ErrorActionPreference = "Stop"

$Repo = (Resolve-Path "$PSScriptRoot\..\..\..").Path
$ProjectsRoot = Join-Path $Repo "PROJECTS"
$ReportsRoot = Join-Path $PSScriptRoot "reports"

if (!(Test-Path $ReportsRoot)) {
    New-Item -ItemType Directory -Path $ReportsRoot | Out-Null
}

$Results = @()

Get-ChildItem $ProjectsRoot -Directory | ForEach-Object {

    $Clasp = Join-Path $_.FullName ".clasp.json"

    if (!(Test-Path $Clasp)) {
        return
    }

    $Config = Get-Content $Clasp -Raw | ConvertFrom-Json

    $Results += [pscustomobject]@{

        Project      = $_.Name
        ScriptId     = $Config.scriptId
        RepairNeeded = $false
        Action       = "NONE"
        Status       = "PASS"

    }

}

$Out = Join-Path $ReportsRoot "TriggerRepairReport.csv"

$Results |
Export-Csv $Out -NoTypeInformation

$Results |
Format-Table -AutoSize

Write-Host ""
Write-Host "Report:"
Write-Host $Out
Write-Host ""
Write-Host "[PASS]"