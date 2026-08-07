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

function Get-MelroseProjects {

    return @(
        Get-ChildItem `
            -LiteralPath $ProjectsRoot `
            -Directory `
            -ErrorAction Stop |
        Where-Object {
            Test-Path -LiteralPath (
                Join-Path $_.FullName ".clasp.json"
            )
        } |
        Sort-Object Name
    )

}

function Get-MelroseProjectMap {

    $results = @()

    foreach ($project in Get-MelroseProjects) {

        $claspPath =
            Join-Path `
                $project.FullName `
                ".clasp.json"

        try {

            $config =
                Get-Content `
                    -LiteralPath $claspPath `
                    -Raw |
                ConvertFrom-Json

            $results +=
                [pscustomobject]@{

                    project =
                        $project.Name

                    scriptId =
                        [string]$config.scriptId

                    rootDir =
                        [string]$config.rootDir

                    folder =
                        $project.FullName

                    claspFile =
                        $claspPath

                    valid =
                        ![string]::IsNullOrWhiteSpace(
                            [string]$config.scriptId
                        )

                }

        }
        catch {

            $results +=
                [pscustomobject]@{

                    project =
                        $project.Name

                    scriptId =
                        ""

                    rootDir =
                        ""

                    folder =
                        $project.FullName

                    claspFile =
                        $claspPath

                    valid =
                        $false

                }

        }

    }

    return @($results)

}

function Get-TriggerManagerStatus {

    $projects =
        Get-MelroseProjectMap

    return [pscustomobject]@{

        subsystem =
            "TRIGGER_MANAGER"

        release =
            "MOS5-012-S1-001"

        version =
            "1.0.0"

        totalProjects =
            $projects.Count

        validProjects =
            @(
                $projects |
                Where-Object {
                    $_.valid
                }
            ).Count

        invalidProjects =
            @(
                $projects |
                Where-Object {
                    !$_.valid
                }
            ).Count

        reportsRoot =
            $ReportsRoot

        generatedAt =
            (Get-Date).ToString("o")

    }

}

$status =
    Get-TriggerManagerStatus

Write-Host ""
Write-Host "MelroseOS Trigger Manager"
Write-Host "-------------------------"
Write-Host "Projects : $($status.totalProjects)"
Write-Host "Valid    : $($status.validProjects)"
Write-Host "Invalid  : $($status.invalidProjects)"
Write-Host ""

if ($status.invalidProjects -eq 0) {
    Write-Host "[PASS]"
}
else {
    Write-Host "[WARNING]"
}