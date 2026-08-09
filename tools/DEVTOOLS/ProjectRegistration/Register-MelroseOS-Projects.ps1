param(
    [string]$RepositoryRoot = "D:\MelroseOS\GitHub\MelroseOS",
    [switch]$PreviewOnly
)

$ErrorActionPreference = "Stop"

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host $Title
    Write-Host ("-" * 72)
}

function Invoke-Clasp {
    param(
        [string[]]$Arguments,
        [string]$WorkingDirectory,
        [string]$UserAlias = ""
    )

    $allArgs = @()

    if ($UserAlias) {
        $allArgs += @("--user", $UserAlias)
    }

    $allArgs += $Arguments

    Push-Location $WorkingDirectory
    try {
        Write-Host ("clasp " + ($allArgs -join " ")) -ForegroundColor DarkGray
        & clasp @allArgs

        if ($LASTEXITCODE -ne 0) {
            throw "clasp exited with code $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }
}

function Get-ClaspCreateCommand {
    $help = (& clasp help 2>&1 | Out-String)

    if ($help -match "create-script") {
        return "create-script"
    }

    return "create"
}

function Ensure-Manifest {
    param([string]$SourceRoot)

    $manifest = Join-Path $SourceRoot "appsscript.json"

    if (Test-Path -LiteralPath $manifest) {
        return $false
    }

    [ordered]@{
        timeZone = "America/Chicago"
        dependencies = @{}
        exceptionLogging = "STACKDRIVER"
        runtimeVersion = "V8"
    } |
        ConvertTo-Json -Depth 10 |
        Set-Content -LiteralPath $manifest -Encoding UTF8

    return $true
}

function Get-ClaspConfig {
    param([string]$ProjectFolder)

    $path = Join-Path $ProjectFolder ".clasp.json"

    if (-not (Test-Path -LiteralPath $path)) {
        return $null
    }

    try {
        return Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
    }
    catch {
        return $null
    }
}

function Get-ScriptId {
    param([string]$ProjectFolder)

    $config = Get-ClaspConfig -ProjectFolder $ProjectFolder

    if ($config) {
        return [string]$config.scriptId
    }

    return ""
}

function Get-ParentId {
    param([string]$ProjectFolder)

    $config = Get-ClaspConfig -ProjectFolder $ProjectFolder

    if ($config -and $config.parentId) {
        return [string]$config.parentId
    }

    return ""
}

function Get-ProjectFolders {
    param([string]$Root)

    $projectsRoot = Join-Path $Root "PROJECTS"

    if (-not (Test-Path -LiteralPath $projectsRoot)) {
        throw "PROJECTS folder not found: $projectsRoot"
    }

    return @(
        Get-ChildItem -LiteralPath $projectsRoot -Directory |
        Where-Object {
            Test-Path -LiteralPath (Join-Path $_.FullName "src")
        } |
        Sort-Object Name
    )
}

function Read-Config {
    param([string]$ConfigPath)

    $map = @{}

    if (Test-Path -LiteralPath $ConfigPath) {
        $config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json

        foreach ($property in $config.projects.PSObject.Properties) {
            $map[$property.Name] = $property.Value
        }
    }

    return $map
}

function Read-ProjectMetadata {
    param(
        [string]$ProjectName,
        [hashtable]$KnownProjects
    )

    $known = $KnownProjects[$ProjectName]

    $defaultTitle = if ($known -and $known.title) {
        [string]$known.title
    }
    else {
        "MelroseOS $ProjectName"
    }

    $defaultMode = if ($known -and $known.mode) {
        [string]$known.mode
    }
    else {
        "standalone"
    }

    $defaultUser = if ($known -and $known.user) {
        [string]$known.user
    }
    else {
        ""
    }

    Write-Host ""
    Write-Host "Configure $ProjectName" -ForegroundColor Cyan

    $title = Read-Host "Apps Script title [$defaultTitle]"

    if (-not $title) {
        $title = $defaultTitle
    }

    $userAlias = Read-Host "clasp account alias [$defaultUser / default]"

    if (-not $userAlias) {
        $userAlias = $defaultUser
    }

    Write-Host ""
    Write-Host "Project modes:"
    Write-Host "  standalone = new standalone Apps Script project"
    Write-Host "  new-sheet  = new Google Sheet with a bound Apps Script project"
    Write-Host "  bound      = bind to an existing Google file ID"
    Write-Host ""

    $mode = Read-Host "Project mode [$defaultMode]"

    if (-not $mode) {
        $mode = $defaultMode
    }

    $mode = $mode.Trim().ToLowerInvariant()

    $parentId = ""

    if ($mode -eq "bound") {
        $parentId = Read-Host "Existing parent Google file ID"

        if (-not $parentId) {
            throw "A parent Google file ID is required for bound mode."
        }
    }
    elseif (
        $mode -ne "standalone" -and
        $mode -ne "new-sheet"
    ) {
        throw "Project mode must be standalone, new-sheet, or bound."
    }

    return [pscustomobject]@{
        projectName = $ProjectName
        title       = $title
        user        = $userAlias
        mode        = $mode
        parentId    = $parentId
    }
}

Write-Section "MelroseOS Project Registration"

if (-not (Test-Path -LiteralPath $RepositoryRoot)) {
    throw "Repository root not found: $RepositoryRoot"
}

if (-not (Get-Command clasp -ErrorAction SilentlyContinue)) {
    throw "clasp is not installed or is not available on PATH."
}

$toolRoot = Join-Path $RepositoryRoot "tools\DEVTOOLS\ProjectRegistration"
$reportRoot = Join-Path $toolRoot "reports"
$configPath = Join-Path $toolRoot "ProjectRegistration.config.json"
$registryPath = Join-Path $toolRoot "ProjectRegistry.json"

New-Item -ItemType Directory -Path $reportRoot -Force | Out-Null

$knownProjects = Read-Config -ConfigPath $configPath
$folders = Get-ProjectFolders -Root $RepositoryRoot

$existing = @(
    $folders |
    Where-Object {
        Test-Path -LiteralPath (Join-Path $_.FullName ".clasp.json")
    }
)

$missing = @(
    $folders |
    Where-Object {
        -not (Test-Path -LiteralPath (Join-Path $_.FullName ".clasp.json"))
    }
)

Write-Host "Detected projects : $($folders.Count)"
Write-Host "Already mapped    : $($existing.Count)"
Write-Host "Missing clasp     : $($missing.Count)"
Write-Host ""

foreach ($project in $folders) {
    $state = if (
        Test-Path -LiteralPath (Join-Path $project.FullName ".clasp.json")
    ) {
        "MAPPED"
    }
    else {
        "MISSING"
    }

    Write-Host ("{0,-18} {1}" -f $project.Name, $state)
}

if ($missing.Count -eq 0) {
    Write-Host ""
    Write-Host "[PASS] Every project with a src folder is already mapped."
    exit 0
}

if ($PreviewOnly) {
    Write-Host ""
    Write-Host "[PREVIEW] No projects were created."
    exit 0
}

Write-Section "Registration Confirmation"
$missing | ForEach-Object { Write-Host ("  - " + $_.Name) }

Write-Host ""
$confirm = Read-Host "Continue? (Y/N)"

if ($confirm.Trim().ToUpperInvariant() -ne "Y") {
    Write-Host "[CANCELLED] No changes were made."
    exit 0
}

$createCommand = Get-ClaspCreateCommand
$results = New-Object System.Collections.Generic.List[object]

foreach ($project in $missing) {
    $started = Get-Date
    $metadata = $null
    $manifestCreated = $false

    try {
        $metadata = Read-ProjectMetadata `
            -ProjectName $project.Name `
            -KnownProjects $knownProjects

        $sourceRoot = Join-Path $project.FullName "src"
        $manifestCreated = Ensure-Manifest -SourceRoot $sourceRoot

        $createArgs = @(
            $createCommand,
            "--title", $metadata.title,
            "--rootDir", "src"
        )

        if ($metadata.mode -eq "bound") {
            $createArgs += @("--parentId", $metadata.parentId)
        }
        elseif ($metadata.mode -eq "new-sheet") {
            $createArgs += @("--type", "sheets")
        }
        else {
            $createArgs += @("--type", "standalone")
        }

        Invoke-Clasp `
            -Arguments $createArgs `
            -WorkingDirectory $project.FullName `
            -UserAlias $metadata.user

        $scriptId = Get-ScriptId -ProjectFolder $project.FullName

        if (-not $scriptId) {
            throw ".clasp.json was created without a Script ID."
        }

        Invoke-Clasp `
            -Arguments @("push", "--force") `
            -WorkingDirectory $project.FullName `
            -UserAlias $metadata.user

        $actualParentId = Get-ParentId -ProjectFolder $project.FullName

        $results.Add([pscustomobject]@{
            projectName     = $project.Name
            status          = "CREATED"
            title           = $metadata.title
            user            = $metadata.user
            mode            = $metadata.mode
            parentId        = if ($actualParentId) {
                $actualParentId
            }
            else {
                $metadata.parentId
            }
            scriptId        = $scriptId
            projectFolder   = $project.FullName
            manifestCreated = $manifestCreated
            appsScriptUrl   = "https://script.google.com/home/projects/$scriptId/edit"
            containerUrl    = if ($actualParentId) {
                "https://docs.google.com/spreadsheets/d/$actualParentId/edit"
            }
            else {
                ""
            }
            startedAt       = $started.ToString("o")
            completedAt     = (Get-Date).ToString("o")
            error           = ""
        })

        Write-Host "[PASS] $($project.Name) => $scriptId" -ForegroundColor Green

        if ($actualParentId) {
            Write-Host "       Sheet => https://docs.google.com/spreadsheets/d/$actualParentId/edit"
        }
    }
    catch {
        $results.Add([pscustomobject]@{
            projectName     = $project.Name
            status          = "FAILED"
            title           = if ($metadata) { $metadata.title } else { "" }
            user            = if ($metadata) { $metadata.user } else { "" }
            mode            = if ($metadata) { $metadata.mode } else { "" }
            parentId        = Get-ParentId -ProjectFolder $project.FullName
            scriptId        = Get-ScriptId -ProjectFolder $project.FullName
            projectFolder   = $project.FullName
            manifestCreated = $manifestCreated
            appsScriptUrl   = ""
            containerUrl    = ""
            startedAt       = $started.ToString("o")
            completedAt     = (Get-Date).ToString("o")
            error           = $_.Exception.Message
        })

        Write-Host "[FAIL] $($project.Name): $($_.Exception.Message)" -ForegroundColor Red
    }
}

$allProjects = foreach ($project in $folders) {
    $scriptId = Get-ScriptId -ProjectFolder $project.FullName
    $parentId = Get-ParentId -ProjectFolder $project.FullName
    $result = $results |
        Where-Object {
            $_.projectName -eq $project.Name
        } |
        Select-Object -First 1

    [pscustomobject]@{
        projectName   = $project.Name
        mapped        = [bool]$scriptId
        scriptId      = $scriptId
        parentId      = $parentId
        projectFolder = $project.FullName
        title         = if ($result) { $result.title } else { "" }
        user          = if ($result) { $result.user } else { "" }
        mode          = if ($result) { $result.mode } else { "" }
        appsScriptUrl = if ($scriptId) {
            "https://script.google.com/home/projects/$scriptId/edit"
        }
        else {
            ""
        }
        containerUrl = if ($parentId) {
            "https://docs.google.com/spreadsheets/d/$parentId/edit"
        }
        else {
            ""
        }
    }
}

[ordered]@{
    generatedAt    = (Get-Date).ToString("o")
    repositoryRoot = $RepositoryRoot
    projectCount   = @($allProjects).Count
    mappedCount    = @(
        $allProjects |
        Where-Object {
            $_.mapped
        }
    ).Count
    projects       = @($allProjects)
} |
    ConvertTo-Json -Depth 10 |
    Set-Content -LiteralPath $registryPath -Encoding UTF8

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$reportPath = Join-Path $reportRoot "ProjectRegistration-$timestamp.json"

$report = [ordered]@{
    generatedAt = (Get-Date).ToString("o")
    created     = @(
        $results |
        Where-Object {
            $_.status -eq "CREATED"
        }
    ).Count
    failed      = @(
        $results |
        Where-Object {
            $_.status -eq "FAILED"
        }
    ).Count
    results     = $results
}

$report |
    ConvertTo-Json -Depth 10 |
    Set-Content -LiteralPath $reportPath -Encoding UTF8

Write-Section "Registration Summary"
Write-Host "Created  : $($report.created)"
Write-Host "Failed   : $($report.failed)"
Write-Host "Registry : $registryPath"
Write-Host "Report   : $reportPath"

if ($report.failed -gt 0) {
    Write-Host ""
    Write-Host "[WARNING] One or more projects failed. Successful projects were preserved."
    exit 2
}

Write-Host ""
Write-Host "[PASS] All missing projects were registered and pushed."
exit 0
