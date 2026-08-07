$ErrorActionPreference = "Stop"

$Repo = (
    Resolve-Path "$PSScriptRoot\..\..\.."
).Path

Write-Host ""
Write-Host "MelroseOS Git <-> Apps Script Validation"
Write-Host "========================================"
Write-Host ""

$ProjectsRoot =
    Join-Path $Repo "PROJECTS"

$ReportFolder =
    Join-Path $PSScriptRoot "reports"

if (!(Test-Path -LiteralPath $ReportFolder)) {

    New-Item `
        -Path $ReportFolder `
        -ItemType Directory `
        -Force |
    Out-Null

}

$Results = @()

$Projects =
    Get-ChildItem `
        -LiteralPath $ProjectsRoot `
        -Directory `
        -ErrorAction Stop |
    Sort-Object Name

foreach ($Project in $Projects) {

    $PotentialSourceRoot =
        Join-Path `
            $Project.FullName `
            "src"

    $PotentialSourceFiles =
        @()

    if (
        Test-Path -LiteralPath $PotentialSourceRoot
    ) {

        $PotentialSourceFiles =
            @(
                Get-ChildItem `
                    -LiteralPath $PotentialSourceRoot `
                    -Recurse `
                    -File `
                    -Include *.gs,*.js `
                    -ErrorAction SilentlyContinue
            )

    }

    $PotentialClasp =
        Join-Path `
            $Project.FullName `
            ".clasp.json"

    # Ignore empty placeholder project folders.
    # A project becomes part of validation only after it
    # contains Apps Script source or a clasp mapping.
    if (
        $PotentialSourceFiles.Count -eq 0 -and
        !(Test-Path -LiteralPath $PotentialClasp)
    ) {

        continue

    }

    $Name =
        $Project.Name

    $ClaspPath =
        $PotentialClasp

    $RootManifest =
        Join-Path `
            $Project.FullName `
            "appsscript.json"

    $SrcManifest =
        Join-Path `
            $Project.FullName `
            "src\appsscript.json"

    $ManifestPath = ""

    if (
        Test-Path -LiteralPath $RootManifest
    ) {

        $ManifestPath =
            $RootManifest

    }
    elseif (
        Test-Path -LiteralPath $SrcManifest
    ) {

        $ManifestPath =
            $SrcManifest

    }

    $ClaspMapped =
        Test-Path -LiteralPath $ClaspPath

    $ScriptId = ""

    $RootDir = ""

    $ClaspValid = $false

    if ($ClaspMapped) {

        try {

            $ClaspConfig =
                Get-Content `
                    -LiteralPath $ClaspPath `
                    -Raw |
                ConvertFrom-Json

            $ScriptId =
                [string]$ClaspConfig.scriptId

            $RootDir =
                [string]$ClaspConfig.rootDir

            $ClaspValid =
                ![string]::IsNullOrWhiteSpace(
                    $ScriptId
                )

        }
        catch {

            $ClaspValid = $false

        }

    }

    $SourceRoot =
        if ($RootDir) {

            Join-Path `
                $Project.FullName `
                $RootDir

        }
        elseif (
            Test-Path -LiteralPath (
                Join-Path `
                    $Project.FullName `
                    "src"
            )
        ) {

            Join-Path `
                $Project.FullName `
                "src"

        }
        else {

            $Project.FullName

        }

    $SourceFiles =
        @(
            Get-ChildItem `
                -LiteralPath $SourceRoot `
                -Recurse `
                -File `
                -Include *.gs,*.js `
                -ErrorAction SilentlyContinue
        )

    $SourceFileCount =
        $SourceFiles.Count

    $ManifestFound =
        ![string]::IsNullOrWhiteSpace(
            $ManifestPath
        )

    $Status =
        if (
            $ClaspValid -and
            $ManifestFound -and
            $SourceFileCount -gt 0
        ) {

            "PASS"

        }
        elseif (
            !$ClaspValid
        ) {

            "FAIL"

        }
        else {

            "WARNING"

        }

    $Results +=
        [pscustomobject]@{

            Project =
                $Name

            Status =
                $Status

            ClaspMapped =
                $ClaspMapped

            ClaspValid =
                $ClaspValid

            ScriptId =
                $ScriptId

            RootDir =
                $RootDir

            ManifestFound =
                $ManifestFound

            ManifestPath =
                $ManifestPath

            SourceFiles =
                $SourceFileCount

            ProjectFolder =
                $Project.FullName

        }

}

$Results |
    Format-Table `
        Project,
        Status,
        ClaspMapped,
        ClaspValid,
        ManifestFound,
        SourceFiles `
        -AutoSize

$Failed =
    @(
        $Results |
        Where-Object {
            $_.Status -eq "FAIL"
        }
    )

$Warnings =
    @(
        $Results |
        Where-Object {
            $_.Status -eq "WARNING"
        }
    )

$Passed =
    @(
        $Results |
        Where-Object {
            $_.Status -eq "PASS"
        }
    )

$OverallStatus =
    if ($Failed.Count -gt 0) {

        "FAIL"

    }
    elseif ($Warnings.Count -gt 0) {

        "WARNING"

    }
    else {

        "PASS"

    }

$Out =
    Join-Path `
        $ReportFolder `
        "GitAppsScriptValidation.json"

$Report =
    [ordered]@{

        generatedAt =
            (Get-Date).ToString("o")

        status =
            $OverallStatus

        totalProjects =
            $Results.Count

        passed =
            $Passed.Count

        warnings =
            $Warnings.Count

        failed =
            $Failed.Count

        projects =
            $Results

    }

$Report |
    ConvertTo-Json -Depth 10 |
    Set-Content `
        -LiteralPath $Out `
        -Encoding UTF8

Write-Host ""
Write-Host "Summary"
Write-Host "----------------------------------------"
Write-Host "Projects : $($Results.Count)"
Write-Host "Passed   : $($Passed.Count)"
Write-Host "Warnings : $($Warnings.Count)"
Write-Host "Failed   : $($Failed.Count)"
Write-Host "Status   : $OverallStatus"
Write-Host ""

Write-Host "Report:"
Write-Host $Out
Write-Host ""

if ($OverallStatus -eq "PASS") {

    Write-Host "[PASS]"
    exit 0

}

if ($OverallStatus -eq "WARNING") {

    Write-Host "[WARNING]"
    exit 0

}

Write-Host "[FAIL]"
exit 1