param(
    [Parameter(Mandatory = $true)]
    [string]$SearchTerm,

    [ValidateSet("Function", "Text", "File")]
    [string]$Mode = "Function",

    [string]$RepositoryRoot = "D:\MelroseOS\GitHub\MelroseOS",

    [switch]$OpenProjects
)

$ErrorActionPreference = "Stop"

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host $Title
    Write-Host ("-" * 78)
}

function Normalize-FullPath {
    param([string]$PathValue)

    if (-not $PathValue) {
        return ""
    }

    try {
        return [System.IO.Path]::GetFullPath($PathValue).TrimEnd("\")
    }
    catch {
        return $PathValue.TrimEnd("\")
    }
}

function Get-ClaspProjects {
    param([string]$Root)

    $projects = @()

    $claspFiles = @(
        Get-ChildItem -LiteralPath $Root -Filter ".clasp.json" -Recurse -Force -File -ErrorAction SilentlyContinue |
        Where-Object {
            $_.FullName -notmatch "\\node_modules\\" -and
            $_.FullName -notmatch "\\\.git\\"
        }
    )

    foreach ($claspFile in $claspFiles) {
        try {
            $config = Get-Content -LiteralPath $claspFile.FullName -Raw | ConvertFrom-Json
            $projectFolder = Normalize-FullPath $claspFile.Directory.FullName

            $sourceRoot = if ($config.rootDir) {
                Normalize-FullPath (Join-Path $projectFolder ([string]$config.rootDir))
            }
            else {
                $projectFolder
            }

            $projectName = Split-Path $projectFolder -Leaf
            $scriptId = [string]$config.scriptId

            $projects += [pscustomobject]@{
                projectName   = $projectName
                projectFolder = $projectFolder
                sourceRoot    = $sourceRoot
                scriptId      = $scriptId
                parentId      = [string]$config.parentId
                claspFile     = $claspFile.FullName
                appsScriptUrl = if ($scriptId) {
                    "https://script.google.com/home/projects/$scriptId/edit"
                } else {
                    ""
                }
            }
        }
        catch {
            $projects += [pscustomobject]@{
                projectName   = Split-Path $claspFile.Directory.FullName -Leaf
                projectFolder = $claspFile.Directory.FullName
                sourceRoot    = ""
                scriptId      = ""
                parentId      = ""
                claspFile     = $claspFile.FullName
                appsScriptUrl = ""
            }
        }
    }

    return @($projects)
}

function Resolve-ProjectForFile {
    param(
        [string]$FilePath,
        [array]$Projects
    )

    $normalized = Normalize-FullPath $FilePath

    $matches = @(
        $Projects |
        Where-Object {
            $_.sourceRoot -and
            $normalized.StartsWith(
                $_.sourceRoot,
                [System.StringComparison]::OrdinalIgnoreCase
            )
        } |
        Sort-Object {
            $_.sourceRoot.Length
        } -Descending
    )

    if ($matches.Count -gt 0) {
        return $matches[0]
    }

    return $null
}

function Get-SourceFiles {
    param([string]$Root)

    return @(
        Get-ChildItem -LiteralPath $Root -Recurse -Force -File -ErrorAction SilentlyContinue |
        Where-Object {
            $_.FullName -notmatch "\\node_modules\\" -and
            $_.FullName -notmatch "\\\.git\\" -and
            $_.FullName -notmatch "\\reports\\" -and
            $_.Extension -in @(".js", ".gs", ".json", ".ps1", ".bat", ".cmd", ".html")
        }
    )
}

function Make-RelativePath {
    param(
        [string]$Root,
        [string]$PathValue
    )

    try {
        return [System.IO.Path]::GetRelativePath($Root, $PathValue)
    }
    catch {
        return $PathValue
    }
}

$SearchTerm = ([string]$SearchTerm).Trim()

if (-not $SearchTerm) {
    throw "A search term is required."
}

if (-not (Test-Path -LiteralPath $RepositoryRoot)) {
    throw "Repository root not found: $RepositoryRoot"
}

Write-Section "MelroseOS Universal Code Locator"
Write-Host "Repository : $RepositoryRoot"
Write-Host "Search     : $SearchTerm"
Write-Host "Mode       : $Mode"

$projects = Get-ClaspProjects -Root $RepositoryRoot
$sourceFiles = Get-SourceFiles -Root $RepositoryRoot
$results = New-Object System.Collections.Generic.List[object]

if ($Mode -eq "File") {
    foreach ($file in $sourceFiles) {
        if ($file.Name -like "*$SearchTerm*") {
            $project = Resolve-ProjectForFile -FilePath $file.FullName -Projects $projects

            $results.Add([pscustomobject]@{
                projectName   = if ($project) { $project.projectName } else { "UNMAPPED" }
                deployed      = [bool]($project -and $project.scriptId)
                scriptId      = if ($project) { $project.scriptId } else { "" }
                sourceFile    = Make-RelativePath -Root $RepositoryRoot -PathValue $file.FullName
                fullSource    = $file.FullName
                line          = 0
                code          = ""
                appsScriptUrl = if ($project) { $project.appsScriptUrl } else { "" }
            })
        }
    }
}
else {
    $escaped = [regex]::Escape($SearchTerm)

    $pattern = if ($Mode -eq "Function") {
        "(?m)^\s*(?:async\s+)?function\s+$escaped\s*\(|(?m)^\s*(?:const|let|var)\s+$escaped\s*="
    }
    else {
        $escaped
    }

    foreach ($file in $sourceFiles) {
        $matches = Select-String -LiteralPath $file.FullName -Pattern $pattern -AllMatches -ErrorAction SilentlyContinue

        foreach ($match in $matches) {
            $project = Resolve-ProjectForFile -FilePath $file.FullName -Projects $projects

            $results.Add([pscustomobject]@{
                projectName   = if ($project) { $project.projectName } else { "UNMAPPED" }
                deployed      = [bool]($project -and $project.scriptId)
                scriptId      = if ($project) { $project.scriptId } else { "" }
                sourceFile    = Make-RelativePath -Root $RepositoryRoot -PathValue $file.FullName
                fullSource    = $file.FullName
                line          = $match.LineNumber
                code          = $match.Line.Trim()
                appsScriptUrl = if ($project) { $project.appsScriptUrl } else { "" }
            })
        }
    }
}

$ordered = @(
    $results |
    Sort-Object `
        @{ Expression = { $_.deployed }; Descending = $true },
        projectName,
        sourceFile,
        line
)

Write-Section "Search Results"

if ($ordered.Count -eq 0) {
    Write-Host "[NOT FOUND] No match was found."
    exit 3
}

$ordered |
    Select-Object projectName, deployed, scriptId, sourceFile, line |
    Format-Table -AutoSize

Write-Section "Detailed Matches"

foreach ($item in $ordered) {
    Write-Host "Project     : $($item.projectName)"
    Write-Host "Deployed    : $($item.deployed)"
    Write-Host "Script ID   : $($item.scriptId)"
    Write-Host "Source file : $($item.fullSource)"
    if ($item.line -gt 0) {
        Write-Host "Line        : $($item.line)"
        Write-Host "Code        : $($item.code)"
    }
    if ($item.appsScriptUrl) {
        Write-Host "Apps Script : $($item.appsScriptUrl)"
    }
    else {
        Write-Host "Apps Script : No clasp mapping found."
    }
    Write-Host ""
}

$reportFolder = Join-Path $RepositoryRoot "tools\DEVTOOLS\Locator\reports"
New-Item -ItemType Directory -Path $reportFolder -Force | Out-Null

$safe = $SearchTerm -replace '[^A-Za-z0-9_-]', '_'
$reportPath = Join-Path $reportFolder ("Locator-" + $safe + "-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".json")

[ordered]@{
    generatedAt = (Get-Date).ToString("o")
    searchTerm  = $SearchTerm
    mode        = $Mode
    matchCount  = $ordered.Count
    mappedCount = @($ordered | Where-Object { $_.deployed }).Count
    results     = $ordered
} |
    ConvertTo-Json -Depth 10 |
    Set-Content -LiteralPath $reportPath -Encoding UTF8

try {
    Set-Clipboard -Value $SearchTerm
}
catch {
    # Clipboard is optional.
}

Write-Section "Summary"
Write-Host "Matches         : $($ordered.Count)"
Write-Host "Mapped matches  : $(@($ordered | Where-Object { $_.deployed }).Count)"
Write-Host "Unmapped matches: $(@($ordered | Where-Object { -not $_.deployed }).Count)"
Write-Host "Report          : $reportPath"
Write-Host ""
Write-Host "Search term copied to clipboard."

$uniqueProjects = @(
    $ordered |
    Where-Object { $_.scriptId } |
    Group-Object scriptId |
    ForEach-Object { $_.Group[0] }
)

$shouldOpen = $OpenProjects.IsPresent

if (-not $OpenProjects.IsPresent) {
    $answer = Read-Host "Open matching Apps Script project(s) now? (Y/N)"
    $shouldOpen = $answer.Trim().ToUpperInvariant() -eq "Y"
}

if ($shouldOpen) {
    if ($uniqueProjects.Count -eq 0) {
        Write-Host "[WARNING] No mapped Apps Script project was found."
    }
    else {
        foreach ($project in $uniqueProjects) {
            Start-Process $project.appsScriptUrl
        }

        Write-Host "[PASS] Opened $($uniqueProjects.Count) Apps Script project(s)."
    }
}

exit 0
