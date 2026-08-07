$ErrorActionPreference = "Stop"

$Repo = (Resolve-Path "$PSScriptRoot\..\..\..").Path
$Projects = Join-Path $Repo "PROJECTS"
$Reports = Join-Path $PSScriptRoot "reports"

if (!(Test-Path $Reports)) {
    New-Item -ItemType Directory -Path $Reports | Out-Null
}

$Results = @()

Get-ChildItem $Projects -Directory | ForEach-Object {

    $Project = $_.Name

    $SourceFiles = Get-ChildItem $_.FullName `
        -Recurse `
        -Include *.gs,*.js `
        -ErrorAction SilentlyContinue

    $Expected = @()

    foreach($File in $SourceFiles){

        $Matches = Select-String `
            -Path $File.FullName `
            -Pattern 'create(TimeBased|Open|Edit|FormSubmit|Installable|Trigger)'

        if($Matches){

            $Expected += $File.Name

        }

    }

    $Results += [pscustomobject]@{

        Project = $Project

        ExpectedTriggerFiles = $Expected.Count

        Status = if($Expected.Count -eq 0){"PASS"}else{"REVIEW"}

    }

}

$Results |
Export-Csv `
    (Join-Path $Reports "MissingTriggerReport.csv") `
    -NoTypeInformation

$Results |
Format-Table -AutoSize

Write-Host ""

if(@($Results|Where-Object{$_.Status -eq "REVIEW"}).Count -eq 0){

    Write-Host "[PASS]"

}
else{

    Write-Host "[REVIEW]"

}