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

    $Src = Join-Path $Project.FullName "src"
    $Clasp = Join-Path $Project.FullName ".clasp.json"

    $SourceFiles = @()

    if (Test-Path -LiteralPath $Src) {

        $SourceFiles =
            @(
                Get-ChildItem `
                    -LiteralPath $Src `
                    -Recurse `
                    -File `
                    -Include *.gs,*.js `
                    -ErrorAction SilentlyContinue
            )

    }

    # Ignore placeholder project folders that have
    # neither Apps Script source nor a clasp mapping.
    if (
        $SourceFiles.Count -eq 0 -and
        !(Test-Path -LiteralPath $Clasp)
    ) {
        return
    }

    $Manifest =
        Join-Path `
            $Project.FullName `
            "src\appsscript.json"

    if (!(Test-Path -LiteralPath $Manifest)) {

        $Manifest =
            Join-Path `
                $Project.FullName `
                "appsscript.json"

    }

    $ClaspExists =
        Test-Path -LiteralPath $Clasp

    $ManifestExists =
        Test-Path -LiteralPath $Manifest

    $Status =
        if (
            $ClaspExists -and
            $ManifestExists -and
            $SourceFiles.Count -gt 0
        ) {
            "PASS"
        }
        else {
            "FAIL"
        }

    $Results +=
        [pscustomobject]@{

            Project =
                $Project.Name

            Clasp =
                $ClaspExists

            Manifest =
                $ManifestExists

            SourceFiles =
                $SourceFiles.Count

            Status =
                $Status

        }

}

$Passed =
    @(
        $Results |
        Where-Object {
            $_.Status -eq "PASS"
        }
    ).Count

$Failed =
    @(
        $Results |
        Where-Object {
            $_.Status -eq "FAIL"
        }
    ).Count

$Out =
    Join-Path `
        $Reports `
        "ConfigurationValidation.json"

[ordered]@{

    generatedAt =
        (Get-Date).ToString("o")

    totalProjects =
        $Results.Count

    passed =
        $Passed

    failed =
        $Failed

    status =
        if ($Failed -eq 0) {
            "PASS"
        }
        else {
            "FAIL"
        }

    projects =
        $Results

} |
ConvertTo-Json -Depth 10 |
Set-Content `
    -LiteralPath $Out `
    -Encoding UTF8

Write-Host ""

$Results |
    Format-Table `
        Project,
        Clasp,
        Manifest,
        SourceFiles,
        Status `
        -AutoSize

Write-Host ""
Write-Host "Passed : $Passed"
Write-Host "Failed : $Failed"
Write-Host ""
Write-Host "Report:"
Write-Host $Out
Write-Host ""

if ($Failed -eq 0) {

    Write-Host "[PASS]"
    exit 0

}

Write-Host "[FAIL]"
exit 1