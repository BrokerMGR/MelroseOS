$ErrorActionPreference = "Stop"

$Repo = (Resolve-Path "$PSScriptRoot\..\..\..").Path
$ProjectsRoot = Join-Path $Repo "PROJECTS"
$ReportsRoot = Join-Path $PSScriptRoot "reports"

if (!(Test-Path $ReportsRoot)) {
    New-Item -ItemType Directory -Path $ReportsRoot -Force | Out-Null
}

$Results = @()

Get-ChildItem $ProjectsRoot -Directory | Sort-Object Name | ForEach-Object {

    $Project = $_
    $Clasp = Join-Path $Project.FullName ".clasp.json"

    if (!(Test-Path $Clasp)) {
        return
    }

    $Config = Get-Content $Clasp -Raw | ConvertFrom-Json
    $ScriptId = [string]$Config.scriptId

    if ([string]::IsNullOrWhiteSpace($ScriptId)) {
        return
    }

    $Results += [pscustomobject]@{
        Project   = $Project.Name
        ScriptId  = $ScriptId
        Folder    = $Project.FullName
        PushReady = $true
        Status    = "READY"
    }

}

$Out = Join-Path $ReportsRoot "AppsScriptPushPlan.csv"

$Results |
Export-Csv $Out -NoTypeInformation

$Results |
Format-Table Project,ScriptId,PushReady,Status -AutoSize

Write-Host ""
Write-Host "Push plan created."
Write-Host "Projects : $($Results.Count)"
Write-Host "Report   : $Out"
Write-Host ""
Write-Host "[PASS]"