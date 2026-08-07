$ErrorActionPreference = "Stop"

$Repo = (Resolve-Path "$PSScriptRoot\..\..\..").Path
$ProjectsRoot = Join-Path $Repo "PROJECTS"
$ReportsRoot = Join-Path $PSScriptRoot "reports"

if (!(Test-Path $ReportsRoot)) {
    New-Item -ItemType Directory -Path $ReportsRoot | Out-Null
}

$Results = @()

Get-ChildItem $ProjectsRoot -Directory | Sort-Object Name | ForEach-Object {

    $Project = $_

    $Src = Join-Path $Project.FullName "src"
    $Clasp = Join-Path $Project.FullName ".clasp.json"

    $SourceCount = 0

    if(Test-Path $Src){
        $SourceCount =
            @(Get-ChildItem $Src -Recurse -Include *.gs,*.js -File).Count
    }

    if($SourceCount -eq 0 -and !(Test-Path $Clasp)){
        return
    }

    $Mapped = $false
    $ScriptId = ""

    if(Test-Path $Clasp){

        try{

            $Config = Get-Content $Clasp -Raw | ConvertFrom-Json

            $ScriptId = $Config.scriptId
            $Mapped = ![string]::IsNullOrWhiteSpace($ScriptId)

        }catch{}

    }

    $Results += [pscustomobject]@{

        Project = $Project.Name

        SourceFiles = $SourceCount

        ClaspMapped = $Mapped

        ScriptId = $ScriptId

    }

}

$Out = Join-Path $ReportsRoot "ProjectDiscovery.csv"

$Results |
Export-Csv $Out -NoTypeInformation

$Results |
Format-Table -AutoSize

Write-Host ""
Write-Host "Projects: $($Results.Count)"
Write-Host ""
Write-Host "[PASS]"