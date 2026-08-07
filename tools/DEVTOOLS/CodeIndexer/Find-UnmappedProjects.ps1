$Repo = (Resolve-Path "$PSScriptRoot\..\..\..").Path

$ProjectsRoot =
    Join-Path $Repo "PROJECTS"

$Results = @()

Get-ChildItem `
    -LiteralPath $ProjectsRoot `
    -Directory |
ForEach-Object {

    $Project = $_

    $SourceRoot =
        Join-Path $Project.FullName "src"

    if (!(Test-Path $SourceRoot)) {
        return
    }

    $ClaspPath =
        Join-Path $Project.FullName ".clasp.json"

    $ScriptId = ""

    $Mapped =
        Test-Path $ClaspPath

    if ($Mapped) {

        try {

            $Config =
                Get-Content `
                    -LiteralPath $ClaspPath `
                    -Raw |
                ConvertFrom-Json

            $ScriptId =
                [string]$Config.scriptId

            if (!$ScriptId) {
                $Mapped = $false
            }

        }
        catch {

            $Mapped = $false

        }

    }

    $SourceFiles =
        @(
            Get-ChildItem `
                -LiteralPath $SourceRoot `
                -Recurse `
                -File `
                -Include *.js,*.gs `
                -ErrorAction SilentlyContinue
        ).Count

    $Results +=
        [pscustomobject]@{

            Project =
                $Project.Name

            Mapped =
                $Mapped

            ScriptId =
                $ScriptId

            SourceFiles =
                $SourceFiles

            ProjectFolder =
                $Project.FullName

            ClaspFile =
                $ClaspPath

        }

}

$Unmapped =
    @(
        $Results |
        Where-Object {
            !$_.Mapped
        }
    )

Write-Host ""
Write-Host "MelroseOS Apps Script Mapping Audit"
Write-Host "==================================="
Write-Host ""

$Results |
    Sort-Object Project |
    Format-Table `
        Project,
        Mapped,
        ScriptId,
        SourceFiles `
        -AutoSize

$ReportFolder =
    Join-Path $PSScriptRoot "reports"

if (!(Test-Path $ReportFolder)) {

    New-Item `
        -Path $ReportFolder `
        -ItemType Directory `
        -Force |
    Out-Null

}

$Out =
    Join-Path `
        $ReportFolder `
        "UnmappedProjects.json"

[ordered]@{

    generatedAt =
        (Get-Date).ToString("o")

    totalProjects =
        $Results.Count

    mappedProjects =
        @(
            $Results |
            Where-Object {
                $_.Mapped
            }
        ).Count

    unmappedProjects =
        $Unmapped.Count

    projects =
        $Results

} |
ConvertTo-Json -Depth 10 |
Set-Content `
    -LiteralPath $Out `
    -Encoding UTF8

Write-Host ""

if ($Unmapped.Count -eq 0) {

    Write-Host "[PASS] Every Apps Script project is mapped."

}
else {

    Write-Host "[WARNING] $($Unmapped.Count) project(s) are not mapped:"
    Write-Host ""

    $Unmapped |
        Select-Object `
            Project,
            SourceFiles,
            ProjectFolder |
        Format-Table -AutoSize

}

Write-Host ""
Write-Host "Report:"
Write-Host $Out