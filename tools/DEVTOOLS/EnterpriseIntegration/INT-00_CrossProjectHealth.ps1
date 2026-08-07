$ErrorActionPreference = "Stop"

$Repo = (Resolve-Path "$PSScriptRoot\..\..\..").Path
$ProjectsRoot = Join-Path $Repo "PROJECTS"
$ReportsRoot = Join-Path $PSScriptRoot "reports"

if (!(Test-Path $ReportsRoot)) {
    New-Item -ItemType Directory -Path $ReportsRoot -Force | Out-Null
}

$RequiredProjects = @(
    "CORE",
    "CRM",
    "BCC",
    "EDU",
    "VERIFY",
    "INTAKE",
    "WEBSITE",
    "MARKETING",
    "ANALYTICS",
    "ARCHIVE"
)

$Results = @()

foreach ($Name in $RequiredProjects) {

    $ProjectFolder = Join-Path $ProjectsRoot $Name
    $ClaspPath = Join-Path $ProjectFolder ".clasp.json"
    $SrcPath = Join-Path $ProjectFolder "src"

    $Exists = Test-Path -LiteralPath $ProjectFolder
    $Mapped = Test-Path -LiteralPath $ClaspPath

    $ScriptId = ""

    if ($Mapped) {

        try {

            $Config =
                Get-Content `
                    -LiteralPath $ClaspPath `
                    -Raw |
                ConvertFrom-Json

            $ScriptId = [string]$Config.scriptId

            if ([string]::IsNullOrWhiteSpace($ScriptId)) {
                $Mapped = $false
            }

        }
        catch {

            $Mapped = $false

        }

    }

    $SourceFiles = 0

    if (Test-Path -LiteralPath $SrcPath) {

        $SourceFiles =
            @(
                Get-ChildItem `
                    -LiteralPath $SrcPath `
                    -Recurse `
                    -File `
                    -Include *.js,*.gs `
                    -ErrorAction SilentlyContinue
            ).Count

    }

    $Status =
        if ($Exists -and $Mapped -and $SourceFiles -gt 0) {
            "PASS"
        }
        else {
            "FAIL"
        }

    $Results += [pscustomobject]@{
        Project     = $Name
        Exists      = $Exists
        ClaspMapped = $Mapped
        ScriptId    = $ScriptId
        SourceFiles = $SourceFiles
        Status      = $Status
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
        $ReportsRoot `
        "CrossProjectHealth.json"

[ordered]@{
    subsystem = "ENTERPRISE_INTEGRATION"
    release = "MOS5-015-INT-001"
    generatedAt = (Get-Date).ToString("o")
    totalProjects = $Results.Count
    passed = $Passed
    failed = $Failed
    status = if ($Failed -eq 0) { "PASS" } else { "FAIL" }
    projects = $Results
} |
ConvertTo-Json -Depth 10 |
Set-Content -LiteralPath $Out -Encoding UTF8

Write-Host ""
Write-Host "MelroseOS Cross-Project Health"
Write-Host "=============================="
Write-Host ""

$Results |
Format-Table Project,Exists,ClaspMapped,SourceFiles,Status -AutoSize

Write-Host ""
Write-Host "Passed : $Passed"
Write-Host "Failed : $Failed"
Write-Host "Report : $Out"
Write-Host ""

if ($Failed -eq 0) {
    Write-Host "[PASS]"
    exit 0
}

Write-Host "[FAIL]"
exit 1