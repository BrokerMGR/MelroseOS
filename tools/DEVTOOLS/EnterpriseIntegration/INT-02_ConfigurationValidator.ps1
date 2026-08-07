$ErrorActionPreference = "Stop"

$Repo = (Resolve-Path "$PSScriptRoot\..\..\..").Path
$Projects = Join-Path $Repo "PROJECTS"
$Reports = Join-Path $PSScriptRoot "reports"

if (!(Test-Path $Reports)) {
    New-Item -ItemType Directory -Path $Reports -Force | Out-Null
}

$Results = @()

Get-ChildItem $Projects -Directory | Sort-Object Name | ForEach-Object {

    $Project = $_

    $Clasp = Join-Path $Project.FullName ".clasp.json"

    $Manifest = Join-Path $Project.FullName "src\appsscript.json"

    if(!(Test-Path $Manifest)){
        $Manifest = Join-Path $Project.FullName "appsscript.json"
    }

    $Results += [pscustomobject]@{

        Project = $Project.Name

        Clasp = Test-Path $Clasp

        Manifest = Test-Path $Manifest

        Status = if(
            (Test-Path $Clasp) -and
            (Test-Path $Manifest)
        ){
            "PASS"
        }
        else{
            "FAIL"
        }

    }

}

$Passed =
@($Results|Where-Object{$_.Status -eq "PASS"}).Count

$Failed =
@($Results|Where-Object{$_.Status -eq "FAIL"}).Count

$Out =
Join-Path $Reports "ConfigurationValidation.json"

[ordered]@{

    generatedAt=(Get-Date).ToString("o")

    passed=$Passed

    failed=$Failed

    status=if($Failed -eq 0){"PASS"}else{"FAIL"}

    projects=$Results

} |
ConvertTo-Json -Depth 10 |
Set-Content $Out

$Results | Format-Table -AutoSize

Write-Host ""

if($Failed -eq 0){

    Write-Host "[PASS]"
    exit 0

}

Write-Host "[FAIL]"
exit 1