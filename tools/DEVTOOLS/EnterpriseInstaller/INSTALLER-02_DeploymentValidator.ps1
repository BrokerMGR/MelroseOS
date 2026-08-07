$ErrorActionPreference = "Stop"

$Repo = (Resolve-Path "$PSScriptRoot\..\..\..").Path
$Projects = Join-Path $Repo "PROJECTS"
$Reports = Join-Path $PSScriptRoot "reports"

if (!(Test-Path $Reports)) {
    New-Item -ItemType Directory -Path $Reports | Out-Null
}

$Results = @()

Get-ChildItem $Projects -Directory | Sort-Object Name | ForEach-Object {

    $Project = $_

    $Clasp = Join-Path $Project.FullName ".clasp.json"

    $Manifest = Join-Path $Project.FullName "src\appsscript.json"

    if(!(Test-Path $Manifest)){
        $Manifest = Join-Path $Project.FullName "appsscript.json"
    }

    $Src = Join-Path $Project.FullName "src"

    $SourceFiles = @()

    if(Test-Path $Src){
        $SourceFiles = Get-ChildItem `
            $Src `
            -Recurse `
            -File `
            -Include *.gs,*.js
    }

    if($SourceFiles.Count -eq 0 -and !(Test-Path $Clasp)){
        return
    }

    $Results += [pscustomobject]@{

        Project = $Project.Name

        Clasp = Test-Path $Clasp

        Manifest = Test-Path $Manifest

        SourceFiles = $SourceFiles.Count

        Status = if(
            (Test-Path $Clasp) -and
            (Test-Path $Manifest) -and
            ($SourceFiles.Count -gt 0)
        ){
            "PASS"
        }
        else{
            "FAIL"
        }

    }

}

$Out =
Join-Path `
$Reports `
"DeploymentValidation.csv"

$Results |
Export-Csv `
$Out `
-NoTypeInformation

$Results |
Format-Table -AutoSize

$Fail =
@($Results|Where-Object{$_.Status -eq "FAIL"}).Count

Write-Host ""

if($Fail -eq 0){

    Write-Host "[PASS]"
    exit 0

}

Write-Host "[FAIL]"
exit 1