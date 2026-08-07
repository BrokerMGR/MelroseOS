$ErrorActionPreference = "Stop"

$Repo = (Resolve-Path "$PSScriptRoot\..\..\..").Path

$Checks = @(
    @{
        Name = "Enterprise Core"
        Path = "PROJECTS\CORE\.clasp.json"
    },
    @{
        Name = "CRM Engine"
        Path = "PROJECTS\CRM\.clasp.json"
    },
    @{
        Name = "Enterprise Intake"
        Path = "PROJECTS\INTAKE\.clasp.json"
    },
    @{
        Name = "Enterprise DEVTOOLS"
        Path = "tools\DEVTOOLS\CodeIndexer"
    },
    @{
        Name = "Trigger Manager"
        Path = "tools\DEVTOOLS\TriggerManager"
    },
    @{
        Name = "Enterprise Installer"
        Path = "tools\DEVTOOLS\EnterpriseInstaller"
    }
)

$Results = @()

foreach($Check in $Checks){

    $Exists =
        Test-Path (
            Join-Path $Repo $Check.Path
        )

    $Results += [pscustomobject]@{

        Component = $Check.Name

        Exists = $Exists

        Status = if($Exists){"PASS"}else{"FAIL"}

    }

}

$Passed =
@(
$Results |
Where-Object{$_.Status -eq "PASS"}
).Count

$Failed =
@(
$Results |
Where-Object{$_.Status -eq "FAIL"}
).Count

$Reports =
Join-Path $PSScriptRoot "reports"

if(!(Test-Path $Reports)){
    New-Item -ItemType Directory -Path $Reports | Out-Null
}

$Out =
Join-Path `
$Reports `
"ProductionValidation.json"

[ordered]@{

    generatedAt =
        (Get-Date).ToString("o")

    passed =
        $Passed

    failed =
        $Failed

    ready =
        ($Failed -eq 0)

    components =
        $Results

} |
ConvertTo-Json -Depth 10 |
Set-Content `
-LiteralPath $Out `
-Encoding UTF8

Write-Host ""
Write-Host "Production Validation"
Write-Host "====================="
Write-Host ""

$Results |
Format-Table -AutoSize

Write-Host ""
Write-Host "Passed : $Passed"
Write-Host "Failed : $Failed"

Write-Host ""
Write-Host "Report:"
Write-Host $Out

Write-Host ""

if($Failed -eq 0){

    Write-Host "[PASS]"
    exit 0

}

Write-Host "[FAIL]"
exit 1