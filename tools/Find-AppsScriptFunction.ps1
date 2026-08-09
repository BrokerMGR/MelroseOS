param(
    [Parameter(Mandatory = $false)]
    [string]$FunctionName = "",

    [Parameter(Mandatory = $false)]
    [string]$RepositoryRoot =
        "D:\MelroseOS\GitHub\MelroseOS",

    [Parameter(Mandatory = $false)]
    [switch]$OpenProjects,

    [Parameter(Mandatory = $false)]
    [switch]$ExactMatch
)

$ErrorActionPreference = "Stop"

function Write-Section {
    param(
        [string]$Title
    )

    Write-Host ""
    Write-Host $Title
    Write-Host ("-" * 70)
}

function Normalize-PathValue {
    param(
        [string]$PathValue
    )

    if (-not $PathValue) {
        return ""
    }

    try {
        return [System.IO.Path]::GetFullPath(
            $PathValue
        ).TrimEnd("\")
    }
    catch {
        return $PathValue.TrimEnd("\")
    }
}

function Get-ProjectUrl {
    param(
        [string]$ScriptId
    )

    if (-not $ScriptId) {
        return ""
    }

    return (
        "https://script.google.com/home/projects/" +
        $ScriptId +
        "/edit"
    )
}

function Get-SourceFiles {
    param(
        [string]$Root
    )

    if (-not (Test-Path -LiteralPath $Root)) {
        return @()
    }

    return @(
        Get-ChildItem `
            -LiteralPath $Root `
            -Recurse `
            -File `
            -Force `
            -ErrorAction SilentlyContinue |
        Where-Object {
            (
                $_.Extension -ieq ".js" -or
                $_.Extension -ieq ".gs"
            ) -and
            $_.FullName -notmatch "\\node_modules\\" -and
            $_.FullName -notmatch "\\reports\\" -and
            $_.FullName -notmatch "\\\.git\\"
        }
    )
}

function Read-ClaspConfiguration {
    param(
        [System.IO.FileInfo]$ClaspFile
    )

    try {
        $configuration =
            Get-Content `
                -LiteralPath $ClaspFile.FullName `
                -Raw |
            ConvertFrom-Json

        $projectFolder =
            $ClaspFile.Directory.FullName

        $sourceRoot =
            if ($configuration.rootDir) {
                Join-Path `
                    $projectFolder `
                    ([string]$configuration.rootDir)
            }
            else {
                $projectFolder
            }

        return [pscustomobject]@{
            Valid         = $true
            ScriptId      = [string]$configuration.scriptId
            RootDir       = [string]$configuration.rootDir
            ProjectFolder = Normalize-PathValue $projectFolder
            SourceRoot    = Normalize-PathValue $sourceRoot
            ClaspFile     = $ClaspFile.FullName
            Error         = ""
        }
    }
    catch {
        return [pscustomobject]@{
            Valid         = $false
            ScriptId      = ""
            RootDir       = ""
            ProjectFolder = $ClaspFile.Directory.FullName
            SourceRoot    = ""
            ClaspFile     = $ClaspFile.FullName
            Error         = $_.Exception.Message
        }
    }
}

function Find-ClaspProjectForFile {
    param(
        [string]$SourceFile,
        [array]$ClaspProjects
    )

    $normalizedSource =
        Normalize-PathValue $SourceFile

    $matches =
        @(
            $ClaspProjects |
            Where-Object {
                $_.Valid -and
                $_.SourceRoot -and
                $normalizedSource.StartsWith(
                    $_.SourceRoot,
                    [System.StringComparison]::OrdinalIgnoreCase
                )
            } |
            Sort-Object {
                $_.SourceRoot.Length
            } -Descending
        )

    if ($matches.Count -gt 0) {
        return $matches[0]
    }

    return $null
}

Write-Section "MelroseOS Universal Apps Script Function Locator"

if (-not (Test-Path -LiteralPath $RepositoryRoot)) {
    throw (
        "Repository root was not found: " +
        $RepositoryRoot
    )
}

if (-not $FunctionName) {
    $FunctionName =
        Read-Host "Enter the function name to locate"
}

$FunctionName =
    ([string]$FunctionName).Trim()

if (-not $FunctionName) {
    throw "A function name is required."
}

try {
    Set-Clipboard `
        -Value $FunctionName
}
catch {
    Write-Host (
        "[WARNING] Could not copy the function name " +
        "to the clipboard."
    )
}

Write-Host "Repository : $RepositoryRoot"
Write-Host "Function   : $FunctionName"
Write-Host "Exact      : $($ExactMatch.IsPresent)"
Write-Host ""

$claspFiles =
    @(
        Get-ChildItem `
            -LiteralPath $RepositoryRoot `
            -Filter ".clasp.json" `
            -Recurse `
            -File `
            -Force `
            -ErrorAction SilentlyContinue |
        Where-Object {
            $_.FullName -notmatch "\\node_modules\\" -and
            $_.FullName -notmatch "\\\.git\\"
        }
    )

$claspProjects =
    @(
        $claspFiles |
        ForEach-Object {
            Read-ClaspConfiguration $_
        }
    )

$sourceFiles =
    Get-SourceFiles `
        -Root $RepositoryRoot

if ($ExactMatch) {
    $escapedName =
        [regex]::Escape(
            $FunctionName
        )

    $pattern =
        "(?m)^\s*(?:async\s+)?" +
        "function\s+" +
        $escapedName +
        "\s*\(|" +
        "(?m)^\s*(?:const|let|var)\s+" +
        $escapedName +
        "\s*="
}
else {
    $pattern =
        [regex]::Escape(
            $FunctionName
        )
}

$results =
    New-Object `
        System.Collections.Generic.List[object]

foreach ($sourceFile in $sourceFiles) {
    $matches =
        Select-String `
            -LiteralPath $sourceFile.FullName `
            -Pattern $pattern `
            -AllMatches `
            -ErrorAction SilentlyContinue

    foreach ($match in $matches) {
        $claspProject =
            Find-ClaspProjectForFile `
                -SourceFile $sourceFile.FullName `
                -ClaspProjects $claspProjects

        $relativePath =
            try {
                [System.IO.Path]::GetRelativePath(
                    $RepositoryRoot,
                    $sourceFile.FullName
                )
            }
            catch {
                $sourceFile.FullName
            }

        $scriptId =
            if ($claspProject) {
                $claspProject.ScriptId
            }
            else {
                ""
            }

        $projectFolder =
            if ($claspProject) {
                $claspProject.ProjectFolder
            }
            else {
                ""
            }

        $projectName =
            if ($projectFolder) {
                Split-Path `
                    $projectFolder `
                    -Leaf
            }
            else {
                "UNMAPPED"
            }

        $results.Add(
            [pscustomobject]@{
                Function       = $FunctionName
                MatchType      = if ($ExactMatch) {
                    "DECLARATION"
                }
                else {
                    "REFERENCE"
                }
                ProjectName    = $projectName
                ScriptId       = $scriptId
                SourceFile     = $relativePath
                FullSourceFile = $sourceFile.FullName
                Line           = $match.LineNumber
                Text           = $match.Line.Trim()
                ProjectFolder  = $projectFolder
                AppsScriptUrl  = Get-ProjectUrl $scriptId
                Deployed       = [bool]$scriptId
            }
        )
    }
}

$orderedResults =
    @(
        $results |
        Sort-Object `
            @{ Expression = { $_.Deployed }; Descending = $true },
            ProjectName,
            SourceFile,
            Line
    )

Write-Section "Search Results"

if ($orderedResults.Count -eq 0) {
    Write-Host (
        "[NOT FOUND] No matching function or reference was found."
    )

    Write-Host ""
    Write-Host (
        "Try running again without Exact Match if you searched " +
        "for a declaration."
    )

    exit 3
}

$orderedResults |
    Select-Object `
        ProjectName,
        Deployed,
        ScriptId,
        SourceFile,
        Line |
    Format-Table `
        -AutoSize

Write-Section "Detailed Matches"

foreach ($result in $orderedResults) {
    Write-Host "Project     : $($result.ProjectName)"
    Write-Host "Deployed    : $($result.Deployed)"
    Write-Host "Script ID   : $($result.ScriptId)"
    Write-Host "Source file : $($result.FullSourceFile)"
    Write-Host "Line        : $($result.Line)"
    Write-Host "Code        : $($result.Text)"

    if ($result.AppsScriptUrl) {
        Write-Host "Apps Script : $($result.AppsScriptUrl)"
    }
    else {
        Write-Host (
            "Apps Script : No local clasp mapping was found."
        )
    }

    Write-Host ""
}

$uniqueProjects =
    @(
        $orderedResults |
        Where-Object {
            $_.ScriptId
        } |
        Group-Object ScriptId |
        ForEach-Object {
            $_.Group[0]
        }
    )

$unmappedResults =
    @(
        $orderedResults |
        Where-Object {
            -not $_.ScriptId
        }
    )

$reportFolder =
    Join-Path `
        $RepositoryRoot `
        "tools\reports"

if (-not (Test-Path -LiteralPath $reportFolder)) {
    New-Item `
        -Path $reportFolder `
        -ItemType Directory `
        -Force |
        Out-Null
}

$safeFunctionName =
    $FunctionName -replace '[^A-Za-z0-9_-]', '_'

$reportPath =
    Join-Path `
        $reportFolder `
        (
            "AppsScriptFunctionLocation-" +
            $safeFunctionName +
            ".json"
        )

$report = [pscustomobject]@{
    generatedAt =
        (Get-Date).ToString("o")

    functionName =
        $FunctionName

    exactMatch =
        $ExactMatch.IsPresent

    totalMatches =
        $orderedResults.Count

    mappedProjectCount =
        $uniqueProjects.Count

    unmappedMatchCount =
        $unmappedResults.Count

    matches =
        $orderedResults
}

$report |
    ConvertTo-Json `
        -Depth 10 |
    Set-Content `
        -LiteralPath $reportPath `
        -Encoding UTF8

Write-Section "Summary"

Write-Host "Matches          : $($orderedResults.Count)"
Write-Host "Mapped projects  : $($uniqueProjects.Count)"
Write-Host "Unmapped matches : $($unmappedResults.Count)"
Write-Host "Report saved     : $reportPath"
Write-Host ""
Write-Host (
    "The function name has been copied to your clipboard."
)

if ($unmappedResults.Count -gt 0) {
    Write-Host ""
    Write-Host (
        "[WARNING] Some matches exist in the repository but are not " +
        "connected to a local clasp project."
    )

    Write-Host (
        "Those files may not yet be deployed to Apps Script."
    )
}

$shouldOpen =
    $OpenProjects.IsPresent

if (-not $OpenProjects.IsPresent) {
    $answer =
        Read-Host (
            "Open all matching Apps Script projects now? (Y/N)"
        )

    $shouldOpen =
        $answer.Trim().ToUpperInvariant() -eq "Y"
}

if ($shouldOpen) {
    if ($uniqueProjects.Count -eq 0) {
        Write-Host ""
        Write-Host (
            "[WARNING] No matching source was mapped to a Script ID."
        )
    }
    else {
        foreach ($project in $uniqueProjects) {
            Start-Process `
                $project.AppsScriptUrl
        }

        Write-Host ""
        Write-Host (
            "[PASS] Opened $($uniqueProjects.Count) matching " +
            "Apps Script project(s)."
        )
    }
}

exit 0