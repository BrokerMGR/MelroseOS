$ErrorActionPreference = "Stop"

$Repo = (Resolve-Path "$PSScriptRoot\..\..\..").Path

$TriggerReports =
    Join-Path `
        $Repo `
        "tools\DEVTOOLS\TriggerManager\reports"

$InstallerReports =
    Join-Path `
        $PSScriptRoot `
        "reports"

if (!(Test-Path $InstallerReports)) {

    New-Item `
        -ItemType Directory `
        -Path $InstallerReports `
        -Force |
    Out-Null

}

$Files = @(
    "TriggerInventory.csv",
    "TriggerHealth.csv",
    "TriggerInstaller.csv",
    "TriggerRepairReport.csv",
    "TriggerDiagnostics.json"
)

$Results = @()

foreach($File in $Files){

    $Path =
        Join-Path `
            $TriggerReports `
            $File

    $Results +=
        [pscustomobject]@{

            File =
                $File

            Exists =
                (Test-Path $Path)

            Path =
                $Path

        }

}

$Out =
    Join-Path `
        $InstallerReports `
        "TriggerIntegration.csv"

$Results |
Export-Csv `
    $Out `
    -NoTypeInformation

$Results |
Format-Table -AutoSize

$Missing =
@(
    $Results |
    Where-Object {
        !$_.Exists
    }
).Count

Write-Host ""

Write-Host "Missing : $Missing"

Write-Host "Report  : $Out"

Write-Host ""

if($Missing -eq 0){

    Write-Host "[PASS]"
    exit 0

}

Write-Host "[FAIL]"
exit 1