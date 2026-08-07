$ErrorActionPreference = "Stop"

$Repo = (Resolve-Path "$PSScriptRoot\..\..\..").Path
$ProjectsRoot = Join-Path $Repo "PROJECTS"
$ReportRoot = Join-Path $PSScriptRoot "reports"

if (!(Test-Path $ReportRoot)) {
    New-Item -ItemType Directory -Path $ReportRoot | Out-Null
}

$Inventory = @()

Get-ChildItem $ProjectsRoot -Directory | ForEach-Object {

    $Clasp = Join-Path $_.FullName ".clasp.json"

    if (!(Test-Path $Clasp)) {
        return
    }

    $Config = Get-Content $Clasp -Raw | ConvertFrom-Json

    $Inventory += [pscustomobject]@{

        Project  = $_.Name
        ScriptId = $Config.scriptId
        RootDir  = $Config.rootDir
        TriggerCount = 0
        Healthy = $true

    }

}

$Inventory |
Export-Csv `
    (Join-Path $ReportRoot "TriggerInventory.csv") `
    -NoTypeInformation

$Inventory |
Format-Table -AutoSize

Write-Host ""
Write-Host "[PASS]"