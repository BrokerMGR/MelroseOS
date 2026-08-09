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

function Add-Candidate {
    param(
        [System.Collections.Generic.List[object]]$List,
        [string]$Path,
        [string]$Reason,
        [string]$Category
    )

    if (Test-Path -LiteralPath $Path) {
        $item = Get-Item -LiteralPath $Path -Force

        $List.Add([pscustomobject]@{
            path     = $item.FullName
            name     = $item.Name
            category = $Category
            reason   = $Reason
            isFolder = $item.PSIsContainer
            size     = if ($item.PSIsContainer) { 0 } else { $item.Length }
        })
    }
}

Write-Section "MelroseOS Safe Cleanup"

if (-not (Test-Path -LiteralPath $RepositoryRoot)) {
    throw "Repository root not found: $RepositoryRoot"
}

$toolRoot = Join-Path $RepositoryRoot "tools\DEVTOOLS"
$quarantineRoot = Join-Path $toolRoot "_Quarantine"
$reportRoot = Join-Path $toolRoot "ProjectRegistration\reports"

New-Item -ItemType Directory -Path $quarantineRoot -Force | Out-Null
New-Item -ItemType Directory -Path $reportRoot -Force | Out-Null

$candidates = New-Object System.Collections.Generic.List[object]

# Known obsolete paths from the earlier package layout.
Add-Candidate $candidates `
    (Join-Path $RepositoryRoot "tools\ProjectRegistration") `
    "Legacy ProjectRegistration location replaced by tools\DEVTOOLS\ProjectRegistration." `
    "LEGACY_TOOL_FOLDER"

# Empty project subfolders and accidental scaffolding.
Get-ChildItem -LiteralPath (Join-Path $RepositoryRoot "PROJECTS") -Directory -ErrorAction SilentlyContinue |
    ForEach-Object {
        foreach ($name in @("web", "assets", "tests")) {
            $candidate = Join-Path $_.FullName $name
            if (Test-Path -LiteralPath $candidate) {
                $files = @(Get-ChildItem -LiteralPath $candidate -Force -Recurse -File -ErrorAction SilentlyContinue)
                if ($files.Count -eq 0) {
                    Add-Candidate $candidates $candidate "Empty project support folder." "EMPTY_FOLDER"
                }
            }
        }
    }

# Common temporary and backup artifacts, excluding Git and node_modules.
Get-ChildItem -LiteralPath $RepositoryRoot -Recurse -Force -File -ErrorAction SilentlyContinue |
    Where-Object {
        $_.FullName -notmatch "\\\.git\\" -and
        $_.FullName -notmatch "\\node_modules\\" -and
        (
            $_.Name -match "\.(tmp|bak|old|orig|rej)$" -or
            $_.Name -match "~$" -or
            $_.Name -match "^Thumbs\.db$" -or
            $_.Name -match "^desktop\.ini$"
        )
    } |
    ForEach-Object {
        Add-Candidate $candidates $_.FullName "Temporary or backup artifact." "TEMP_FILE"
    }

# Zero-byte source files are suspicious; quarantine only, never silently delete.
Get-ChildItem -LiteralPath (Join-Path $RepositoryRoot "PROJECTS") -Recurse -Force -File -ErrorAction SilentlyContinue |
    Where-Object {
        $_.Extension -in @(".js", ".gs", ".json") -and
        $_.Length -eq 0
    } |
    ForEach-Object {
        Add-Candidate $candidates $_.FullName "Zero-byte source or manifest file." "ZERO_BYTE_SOURCE"
    }

# Exact duplicate BAT launchers from the old tool name.
foreach ($name in @(
    "Find-BCC-AppsScript.bat",
    "Find-AppsScript-Function.bat"
)) {
    $path = Join-Path $RepositoryRoot $name
    if (Test-Path -LiteralPath $path) {
        Add-Candidate $candidates $path "Legacy launcher; review before removal." "LEGACY_LAUNCHER"
    }
}

$unique = @(
    $candidates |
    Group-Object path |
    ForEach-Object { $_.Group[0] } |
    Sort-Object category, path
)

Write-Host "Candidates found : $($unique.Count)"
Write-Host ""

if ($unique.Count -eq 0) {
    Write-Host "[PASS] No cleanup candidates found."
    exit 0
}

$unique |
    Select-Object category, name, reason, path |
    Format-Table -Wrap -AutoSize

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$reportPath = Join-Path $reportRoot "CleanupPreview-$timestamp.json"

[ordered]@{
    generatedAt = (Get-Date).ToString("o")
    previewOnly  = $PreviewOnly.IsPresent
    count        = $unique.Count
    candidates   = $unique
} |
    ConvertTo-Json -Depth 10 |
    Set-Content -LiteralPath $reportPath -Encoding UTF8

Write-Host ""
Write-Host "Report saved: $reportPath"

if ($PreviewOnly) {
    Write-Host ""
    Write-Host "[PREVIEW] Nothing was moved or deleted."
    exit 0
}

Write-Host ""
Write-Host "Cleanup is quarantine-only."
Write-Host "No file will be permanently deleted."
Write-Host ""

$confirm = Read-Host "Move all listed candidates into quarantine? (Y/N)"

if ($confirm.Trim().ToUpperInvariant() -ne "Y") {
    Write-Host "[CANCELLED] No changes were made."
    exit 0
}

$sessionRoot = Join-Path $quarantineRoot $timestamp
New-Item -ItemType Directory -Path $sessionRoot -Force | Out-Null

$moved = 0
$failed = 0
$moveResults = @()

foreach ($candidate in $unique) {
    try {
        $relative = [System.IO.Path]::GetRelativePath($RepositoryRoot, $candidate.path)
        $destination = Join-Path $sessionRoot $relative
        $destinationParent = Split-Path $destination -Parent

        New-Item -ItemType Directory -Path $destinationParent -Force | Out-Null
        Move-Item -LiteralPath $candidate.path -Destination $destination -Force

        $moved += 1
        $moveResults += [pscustomobject]@{
            source      = $candidate.path
            destination = $destination
            status      = "MOVED"
            error       = ""
        }
    }
    catch {
        $failed += 1
        $moveResults += [pscustomobject]@{
            source      = $candidate.path
            destination = ""
            status      = "FAILED"
            error       = $_.Exception.Message
        }
    }
}

$moveReportPath = Join-Path $reportRoot "CleanupMove-$timestamp.json"

[ordered]@{
    generatedAt = (Get-Date).ToString("o")
    quarantine  = $sessionRoot
    moved       = $moved
    failed      = $failed
    results     = $moveResults
} |
    ConvertTo-Json -Depth 10 |
    Set-Content -LiteralPath $moveReportPath -Encoding UTF8

Write-Host ""
Write-Host "Moved      : $moved"
Write-Host "Failed     : $failed"
Write-Host "Quarantine : $sessionRoot"
Write-Host "Report     : $moveReportPath"

if ($failed -gt 0) {
    exit 2
}

Write-Host ""
Write-Host "[PASS] Cleanup completed using quarantine mode."
exit 0
