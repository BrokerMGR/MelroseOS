$ErrorActionPreference = "Stop"

$Repo = (Resolve-Path "$PSScriptRoot\..\..\..").Path
$Reports = Join-Path $PSScriptRoot "reports"

if (!(Test-Path $Reports)) {
    New-Item -ItemType Directory -Path $Reports -Force | Out-Null
}

$Checks = @()

$Checks += [pscustomobject]@{
    Check = "Git Repository"
    Status = Test-Path (Join-Path $Repo ".git")
}

$Checks += [pscustomobject]@{
    Check = "Projects Folder"
    Status = Test-Path (Join-Path $Repo "PROJECTS")
}

$Checks += [pscustomobject]@{
    Check = "DEVTOOLS Folder"
    Status = Test-Path (Join-Path $Repo "tools\DEVTOOLS")
}

$Checks += [pscustomobject]@{
    Check = "Code Indexer"
    Status = Test-Path (Join-Path $Repo "tools\DEVTOOLS\CodeIndexer")
}

$Checks += [pscustomobject]@{
    Check = "Trigger Manager"
    Status = Test-Path (Join-Path $Repo "tools\DEVTOOLS\TriggerManager")
}

$Checks += [pscustomobject]@{
    Check = "Enterprise Installer"
    Status = $true
}

$Out = Join-Path $Reports "EnvironmentVerification.csv"

$Checks |
Export-Csv $Out -NoTypeInformation

$Checks |
Format-Table -AutoSize

$Fail =
@(
    $Checks |
    Where-Object {
        !$_.Status
    }
).Count

Write-Host ""
Write-Host "Report : $Out"
Write-Host ""

if($Fail -eq 0){

    Write-Host "[PASS]"
    exit 0

}

Write-Host "[FAIL]"
exit 1