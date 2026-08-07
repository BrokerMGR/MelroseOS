$ErrorActionPreference = "Stop"

$Repo = (Resolve-Path "$PSScriptRoot\..\..\..").Path
$Projects = Join-Path $Repo "PROJECTS"
$Reports = Join-Path $PSScriptRoot "reports"

if (!(Test-Path $Reports)) {
    New-Item -ItemType Directory -Path $Reports -Force | Out-Null
}

$Contracts = @(
    "CORE",
    "CRM",
    "INTAKE",
    "BCC",
    "VERIFY",
    "EDU",
    "WEBSITE",
    "MARKETING",
    "ANALYTICS",
    "ARCHIVE"
)

$Results = @()

foreach($Contract in $Contracts){

    $Folder = Join-Path $Projects $Contract

    $Exists = Test-Path $Folder

    $Source = 0

    if($Exists){

        $Source = @(
            Get-ChildItem `
                $Folder `
                -Recurse `
                -Include *.gs,*.js `
                -File `
                -ErrorAction SilentlyContinue
        ).Count

    }

    $Results += [pscustomobject]@{

        Contract = $Contract

        Exists = $Exists

        SourceFiles = $Source

        Status = if(
            $Exists -and
            $Source -gt 0
        ){
            "PASS"
        }
        else{
            "FAIL"
        }

    }

}

$Passed =
@(
$Results |
Where-Object{
    $_.Status -eq "PASS"
}
).Count

$Failed =
@(
$Results |
Where-Object{
    $_.Status -eq "FAIL"
}
).Count

$Out =
Join-Path `
$Reports `
"SharedDataContracts.json"

[ordered]@{

    generatedAt =
        (Get-Date).ToString("o")

    passed =
        $Passed

    failed =
        $Failed

    status =
        if($Failed -eq 0){
            "PASS"
        }
        else{
            "FAIL"
        }

    contracts =
        $Results

} |
ConvertTo-Json -Depth 10 |
Set-Content `
-LiteralPath $Out `
-Encoding UTF8

Write-Host ""
Write-Host "Shared Data Contracts"
Write-Host "====================="
Write-Host ""

$Results |
Format-Table -AutoSize

Write-Host ""

if($Failed -eq 0){

    Write-Host "[PASS]"
    exit 0

}

Write-Host "[FAIL]"
exit 1