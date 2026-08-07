$ErrorActionPreference = "Stop"

$Repo = (
    Resolve-Path "$PSScriptRoot\..\..\.."
).Path

$ProjectsRoot =
    Join-Path $Repo "PROJECTS"

$ReportsRoot =
    Join-Path $PSScriptRoot "reports"

if (!(Test-Path -LiteralPath $ReportsRoot)) {

    New-Item `
        -Path $ReportsRoot `
        -ItemType Directory `
        -Force |
    Out-Null

}

function Get-MelroseInstallerProjects {

    $results = @()

    $projects =
        Get-ChildItem `
            -LiteralPath $ProjectsRoot `
            -Directory `
            -ErrorAction Stop |
        Sort-Object Name

    foreach ($project in $projects) {

        $src =
            Join-Path `
                $project.FullName `
                "src"

        $clasp =
            Join-Path `
                $project.FullName `
                ".clasp.json"

        $sourceFiles =
            @()

        if (
            Test-Path -LiteralPath $src
        ) {

            $sourceFiles =
                @(
                    Get-ChildItem `
                        -LiteralPath $src `
                        -Recurse `
                        -File `
                        -Include *.js,*.gs `
                        -ErrorAction SilentlyContinue
                )

        }

        if (
            $sourceFiles.Count -eq 0 -and
            !(Test-Path -LiteralPath $clasp)
        ) {

            continue

        }

        $scriptId = ""

        $mapped = $false

        if (
            Test-Path -LiteralPath $clasp
        ) {

            try {

                $config =
                    Get-Content `
                        -LiteralPath $clasp `
                        -Raw |
                    ConvertFrom-Json

                $scriptId =
                    [string]$config.scriptId

                $mapped =
                    ![string]::IsNullOrWhiteSpace(
                        $scriptId
                    )

            }
            catch {

                $mapped = $false

            }

        }

        $results +=
            [pscustomobject]@{

                Project =
                    $project.Name

                Folder =
                    $project.FullName

                SourceFiles =
                    $sourceFiles.Count

                ClaspMapped =
                    $mapped

                ScriptId =
                    $scriptId

            }

    }

    return @($results)

}

$Projects =
    Get-MelroseInstallerProjects

$Mapped =
    @(
        $Projects |
        Where-Object {
            $_.ClaspMapped
        }
    )

$Unmapped =
    @(
        $Projects |
        Where-Object {
            !$_.ClaspMapped
        }
    )

Write-Host ""
Write-Host "MelroseOS Enterprise Installer"
Write-Host "=============================="
Write-Host ""

$Projects |
    Format-Table `
        Project,
        SourceFiles,
        ClaspMapped,
        ScriptId `
        -AutoSize

Write-Host ""
Write-Host "Projects : $($Projects.Count)"
Write-Host "Mapped   : $($Mapped.Count)"
Write-Host "Unmapped : $($Unmapped.Count)"
Write-Host ""

$Report =
    [ordered]@{

        subsystem =
            "ENTERPRISE_INSTALLER"

        release =
            "MOS5-013-S1-001"

        version =
            "1.0.0"

        generatedAt =
            (Get-Date).ToString("o")

        totalProjects =
            $Projects.Count

        mappedProjects =
            $Mapped.Count

        unmappedProjects =
            $Unmapped.Count

        projects =
            $Projects

    }

$Out =
    Join-Path `
        $ReportsRoot `
        "EnterpriseInstallerCore.json"

$Report |
    ConvertTo-Json -Depth 10 |
    Set-Content `
        -LiteralPath $Out `
        -Encoding UTF8

Write-Host "Report:"
Write-Host $Out
Write-Host ""

if ($Unmapped.Count -eq 0) {

    Write-Host "[PASS]"
    exit 0

}

Write-Host "[WARNING]"
exit 0