$ErrorActionPreference = "Stop"

$Repo = (Resolve-Path "$PSScriptRoot\..\..\..").Path
$ProjectsRoot = Join-Path $Repo "PROJECTS"
$ReportsRoot = Join-Path $PSScriptRoot "reports"

if (!(Test-Path $ReportsRoot)) {
    New-Item -ItemType Directory -Path $ReportsRoot -Force | Out-Null
}

$Dependencies = @{
    CORE        = @()
    CRM         = @("CORE")
    BCC         = @("CORE","CRM")
    EDU         = @("CORE")
    VERIFY      = @("CORE")
    INTAKE      = @("CORE","CRM","VERIFY")
    WEBSITE     = @("CORE","CRM","INTAKE")
    MARKETING   = @("CORE","CRM")
    ANALYTICS   = @("CORE","CRM")
    ARCHIVE     = @("CORE")
}

$Results = @()

foreach($Project in $Dependencies.Keys){

    $Missing = @()

    foreach($Dependency in $Dependencies[$Project]){

        if(!(Test-Path (Join-Path $ProjectsRoot $Dependency))){
            $Missing += $Dependency
        }

    }

    $Results += [pscustomobject]@{

        Project = $Project

        Dependencies = $Dependencies[$Project] -join ", "

        Missing = $Missing -join ", "

        Status = if($Missing.Count -eq 0){"PASS"}else{"FAIL"}

    }

}

$Passed =
@($Results|Where-Object{$_.Status -eq "PASS"}).Count

$Failed =
@($Results|Where-Object{$_.Status -eq "FAIL"}).Count

$Out =
Join-Path `
$ReportsRoot `
"DependencyResolver.json"

[ordered]@{

    generatedAt = (Get-Date).ToString("o")

    passed = $Passed

    failed = $Failed

    status = if($Failed -eq 0){"PASS"}else{"FAIL"}

    projects = $Results

} |
ConvertTo-Json -Depth 10 |
Set-Content `
-LiteralPath $Out `
-Encoding UTF8

Write-Host ""
Write-Host "Enterprise Dependency Resolver"
Write-Host "=============================="
Write-Host ""

$Results |
Format-Table -AutoSize

Write-Host ""
Write-Host "Passed : $Passed"
Write-Host "Failed : $Failed"
Write-Host ""

if($Failed -eq 0){

    Write-Host "[PASS]"
    exit 0

}

Write-Host "[FAIL]"
exit 1