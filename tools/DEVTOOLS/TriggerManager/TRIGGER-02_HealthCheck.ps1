$ErrorActionPreference = "Stop"

$Repo = (Resolve-Path "$PSScriptRoot\..\..\..").Path
$ProjectsRoot = Join-Path $Repo "PROJECTS"
$ReportRoot = Join-Path $PSScriptRoot "reports"

if (!(Test-Path $ReportRoot)) {
    New-Item -ItemType Directory -Path $ReportRoot | Out-Null
}

$Results = @()

Get-ChildItem $ProjectsRoot -Directory | ForEach-Object {

    $Clasp = Join-Path $_.FullName ".clasp.json"

    if (!(Test-Path $Clasp)) {
        return
    }

    try {

        $Config = Get-Content $Clasp -Raw | ConvertFrom-Json

        $Status = "PASS"

        if ([string]::IsNullOrWhiteSpace($Config.scriptId)) {
            $Status = "FAIL"
        }

    }
    catch {

        $Status = "FAIL"

        $Config = @{
            scriptId = ""
            rootDir = ""
        }

    }

    $Results += [pscustomobject]@{

        Project  = $_.Name
        Status   = $Status
        ScriptId = $Config.scriptId
        RootDir  = $Config.rootDir

    }

}

$Results |
Export-Csv `
    (Join-Path $ReportRoot "TriggerHealth.csv") `
    -NoTypeInformation

$Results |
Format-Table -AutoSize

$Pass =
    @($Results | Where-Object {$_.Status -eq "PASS"}).Count

$Fail =
    @($Results | Where-Object {$_.Status -eq "FAIL"}).Count

Write-Host ""
Write-Host "Summary"
Write-Host "-------"
Write-Host "PASS : $Pass"
Write-Host "FAIL : $Fail"

if($Fail -eq 0){

    Write-Host ""
    Write-Host "[PASS]"

}
else{

    Write-Host ""
    Write-Host "[FAIL]"

}