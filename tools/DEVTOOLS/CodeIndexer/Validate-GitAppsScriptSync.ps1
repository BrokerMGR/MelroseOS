$Repo = (Resolve-Path "$PSScriptRoot\..\..\..").Path

Write-Host ""
Write-Host "MelroseOS Git ↔ Apps Script Validation"
Write-Host "======================================"
Write-Host ""

$Projects = Get-ChildItem "$Repo\PROJECTS" -Directory

$Results = @()

foreach($Project in $Projects){

    $Name = $Project.Name

    $Clasp = Join-Path $Project.FullName ".clasp.json"

    $Manifest = Join-Path $Project.FullName "appsscript.json"

    if(!(Test-Path $Manifest)){
        $Manifest = Join-Path $Project.FullName "src\appsscript.json"
    }

    $Results += [pscustomobject]@{

        Project = $Name

        ClaspMapped = Test-Path $Clasp

        ManifestFound = Test-Path $Manifest

        SourceFiles = (
            Get-ChildItem $Project.FullName `
            -Recurse `
            -Include *.gs,*.js |
            Measure-Object
        ).Count

    }

}

$Results | Format-Table -AutoSize

$Out = Join-Path $PSScriptRoot "reports\GitAppsScriptValidation.json"

$Results |
ConvertTo-Json -Depth 5 |
Out-File $Out

Write-Host ""
Write-Host "Report:"
Write-Host $Out