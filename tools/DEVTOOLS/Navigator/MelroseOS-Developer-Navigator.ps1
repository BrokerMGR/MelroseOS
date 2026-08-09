param(
    [string]$RepositoryRoot = "D:\MelroseOS\GitHub\MelroseOS"
)

$ErrorActionPreference = "Stop"

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host $Title
    Write-Host ("-" * 88)
}

function Normalize-FullPath {
    param([string]$PathValue)
    if (-not $PathValue) { return "" }

    try {
        return [System.IO.Path]::GetFullPath($PathValue).TrimEnd("\")
    }
    catch {
        return $PathValue.TrimEnd("\")
    }
}

function Make-RelativePath {
    param([string]$Root, [string]$PathValue)
    try {
        return [System.IO.Path]::GetRelativePath($Root, $PathValue)
    }
    catch {
        return $PathValue
    }
}

function Get-AppsScriptUrl {
    param([string]$ScriptId)

    if (-not $ScriptId) { return "" }

    # Direct editor URL. This matches the URL clasp returns when a script is created.
    return "https://script.google.com/d/$ScriptId/edit"
}

function Get-ParentUrl {
    param([string]$ParentId)

    if (-not $ParentId) { return "" }

    # Parent ID is most commonly a Google Sheet in MelroseOS.
    return "https://docs.google.com/spreadsheets/d/$ParentId/edit"
}

function Get-ClaspProjects {
    param([string]$Root)

    $items = @()

    $files = @(
        Get-ChildItem -LiteralPath $Root -Filter ".clasp.json" -Recurse -Force -File -ErrorAction SilentlyContinue |
        Where-Object {
            $_.FullName -notmatch "\\node_modules\\" -and
            $_.FullName -notmatch "\\\.git\\"
        }
    )

    foreach ($file in $files) {
        try {
            $config = Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json
            $projectFolder = Normalize-FullPath $file.Directory.FullName

            $sourceRoot = if ($config.rootDir) {
                Normalize-FullPath (Join-Path $projectFolder ([string]$config.rootDir))
            }
            else {
                $projectFolder
            }

            $scriptId = [string]$config.scriptId
            $parentId = [string]$config.parentId

            $items += [pscustomobject]@{
                projectName   = Split-Path $projectFolder -Leaf
                projectFolder = $projectFolder
                sourceRoot    = $sourceRoot
                scriptId      = $scriptId
                parentId      = $parentId
                claspFile     = $file.FullName
                appsScriptUrl = Get-AppsScriptUrl $scriptId
                parentUrl     = Get-ParentUrl $parentId
            }
        }
        catch {
            Write-Host "[WARNING] Could not parse $($file.FullName)" -ForegroundColor Yellow
        }
    }

    return @($items)
}

function Resolve-ProjectForFile {
    param([string]$FilePath, [array]$Projects)

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
        Sort-Object { $_.sourceRoot.Length } -Descending
    )

    if ($matches.Count -gt 0) {
        return $matches[0]
    }

    return $null
}

function Get-SearchableFiles {
    param([string]$Root)

    return @(
        Get-ChildItem -LiteralPath $Root -Recurse -Force -File -ErrorAction SilentlyContinue |
        Where-Object {
            $_.FullName -notmatch "\\node_modules\\" -and
            $_.FullName -notmatch "\\\.git\\" -and
            $_.FullName -notmatch "\\tools\\reports\\" -and
            $_.FullName -notmatch "\\tools\\DEVTOOLS\\[^\\]+\\reports\\" -and
            $_.FullName -notmatch "\\tools\\MACS\\reports\\" -and
            $_.Extension -in @(".js", ".gs", ".json", ".ps1", ".bat", ".cmd", ".html", ".md", ".txt")
        }
    )
}

function Convert-ToMappedResults {
    param([array]$Matches, [array]$Projects)

    return @(
        foreach ($m in $Matches) {
            $project = Resolve-ProjectForFile -FilePath $m.fullSource -Projects $Projects

            [pscustomobject]@{
                Project       = if ($project) { $project.projectName } else { "UNMAPPED" }
                Deployed      = [bool]($project -and $project.scriptId)
                ScriptId      = if ($project) { $project.scriptId } else { "" }
                ParentId      = if ($project) { $project.parentId } else { "" }
                File          = $m.file
                Line          = $m.line
                Code          = $m.code
                FullSource    = $m.fullSource
                AppsScriptUrl = if ($project) { $project.appsScriptUrl } else { "" }
                ParentUrl     = if ($project) { $project.parentUrl } else { "" }
            }
        }
    )
}

function Show-Matches {
    param([array]$Matches, [array]$Projects)

    if (@($Matches).Count -eq 0) {
        Write-Host "[NOT FOUND] No matching result."
        return
    }

    $mapped = Convert-ToMappedResults -Matches $Matches -Projects $Projects

    $mapped |
        Select-Object Project, Deployed, ScriptId, File, Line |
        Format-Table -AutoSize

    Write-Section "Detailed Matches"

    foreach ($item in $mapped) {
        Write-Host "Project     : $($item.Project)"
        Write-Host "Deployed    : $($item.Deployed)"
        Write-Host "Script ID   : $($item.ScriptId)"
        Write-Host "Parent ID   : $($item.ParentId)"
        Write-Host "Source file : $($item.FullSource)"

        if ($item.Line -gt 0) {
            Write-Host "Line        : $($item.Line)"
        }

        if ($item.Code) {
            Write-Host "Code        : $($item.Code)"
        }

        if ($item.AppsScriptUrl) {
            Write-Host "Apps Script : $($item.AppsScriptUrl)"
        }
        else {
            Write-Host "Apps Script : No clasp mapping found."
        }

        if ($item.ParentUrl) {
            Write-Host "Parent file : $($item.ParentUrl)"
        }

        Write-Host ""
    }

    $uniqueProjects = @(
        $mapped |
        Where-Object { $_.ScriptId } |
        Group-Object ScriptId |
        ForEach-Object { $_.Group[0] }
    )

    if ($uniqueProjects.Count -eq 0) {
        Write-Host "[WARNING] No mapped Apps Script project was found for these matches." -ForegroundColor Yellow
        return
    }

    $answer = Read-Host "Open matching Apps Script project(s)? (Y/N)"

    if ($answer.Trim().ToUpperInvariant() -eq "Y") {
        foreach ($project in $uniqueProjects) {
            if ($project.AppsScriptUrl) {
                try {
                    Start-Process $project.AppsScriptUrl
                    Write-Host "[PASS] Opened: $($project.AppsScriptUrl)" -ForegroundColor Green
                }
                catch {
                    Write-Host "[WARNING] Apps Script URL failed to open." -ForegroundColor Yellow

                    if ($project.ParentUrl) {
                        Write-Host "Opening parent file instead: $($project.ParentUrl)"
                        Start-Process $project.ParentUrl
                    }
                    else {
                        Write-Host "Direct URL: $($project.AppsScriptUrl)"
                    }
                }
            }
        }
    }
}

function Search-Function {
    param([string]$Name, [array]$Files, [array]$Projects)

    $escaped = [regex]::Escape($Name)
    $pattern = "(?m)^\s*(?:async\s+)?function\s+$escaped\s*\(|(?m)^\s*(?:const|let|var)\s+$escaped\s*="

    $matches = @()

    foreach ($file in $Files) {
        if ($file.Extension -notin @(".js", ".gs")) { continue }

        foreach ($hit in @(Select-String -LiteralPath $file.FullName -Pattern $pattern -AllMatches -ErrorAction SilentlyContinue)) {
            $matches += [pscustomobject]@{
                file       = Make-RelativePath $RepositoryRoot $file.FullName
                fullSource = $file.FullName
                line       = $hit.LineNumber
                code       = $hit.Line.Trim()
            }
        }
    }

    Show-Matches -Matches $matches -Projects $Projects
}

function Search-Text {
    param([string]$Term, [array]$Files, [array]$Projects)

    $escaped = [regex]::Escape($Term)
    $matches = @()

    foreach ($file in $Files) {
        foreach ($hit in @(Select-String -LiteralPath $file.FullName -Pattern $escaped -AllMatches -ErrorAction SilentlyContinue)) {
            $matches += [pscustomobject]@{
                file       = Make-RelativePath $RepositoryRoot $file.FullName
                fullSource = $file.FullName
                line       = $hit.LineNumber
                code       = $hit.Line.Trim()
            }
        }
    }

    Show-Matches -Matches $matches -Projects $Projects
}

function Search-FileName {
    param([string]$Term, [array]$Files, [array]$Projects)

    $matches = foreach ($file in $Files) {
        if ($file.Name -like "*$Term*") {
            [pscustomobject]@{
                file       = Make-RelativePath $RepositoryRoot $file.FullName
                fullSource = $file.FullName
                line       = 0
                code       = ""
            }
        }
    }

    Show-Matches -Matches @($matches) -Projects $Projects
}

function Show-Projects {
    param([array]$Projects)

    $Projects |
        Select-Object projectName, scriptId, parentId, projectFolder |
        Format-Table -AutoSize

    $name = Read-Host "Enter project name to open, or press Enter to return"

    if (-not $name) {
        return
    }

    $matches = @(
        $Projects |
        Where-Object {
            $_.projectName -like "*$name*"
        }
    )

    foreach ($project in $matches) {
        if ($project.appsScriptUrl) {
            Start-Process $project.appsScriptUrl
        }
        elseif ($project.parentUrl) {
            Start-Process $project.parentUrl
        }
    }
}

function Search-ScriptId {
    param([string]$Term, [array]$Projects)

    $matches = @(
        $Projects |
        Where-Object {
            $_.scriptId -like "*$Term*" -or
            $_.parentId -like "*$Term*"
        }
    )

    $matches |
        Select-Object projectName, scriptId, parentId, projectFolder |
        Format-Table -AutoSize

    if ($matches.Count -gt 0) {
        $answer = Read-Host "Open first matching project? (Y/N)"
        if ($answer.Trim().ToUpperInvariant() -eq "Y") {
            if ($matches[0].appsScriptUrl) {
                Start-Process $matches[0].appsScriptUrl
            }
            elseif ($matches[0].parentUrl) {
                Start-Process $matches[0].parentUrl
            }
        }
    }
}

function Show-MacsReport {
    param([string]$ReportName)

    $path = Join-Path $RepositoryRoot ("tools\MACS\reports\" + $ReportName)

    if (-not (Test-Path -LiteralPath $path)) {
        Write-Host "[FAIL] Report not found: $path"
        return
    }

    $data = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
    $data | ConvertTo-Json -Depth 20
}

function Show-FunctionDependencies {
    param([string]$FunctionName)

    $macs = Join-Path $RepositoryRoot "tools\MACS\reports"
    $indexPath = Join-Path $macs "FunctionIndex.json"
    $graphPath = Join-Path $macs "DependencyGraph.json"

    if (-not (Test-Path -LiteralPath $indexPath)) {
        Write-Host "[FAIL] MACS FunctionIndex.json is missing. Run MACS first."
        return
    }

    $indexRaw = Get-Content -LiteralPath $indexPath -Raw
    $index = $indexRaw | ConvertFrom-Json

    Write-Section "Function Index Matches"

    $indexMatches = @(
        $index |
        Where-Object {
            $_.name -eq $FunctionName -or
            $_.function -eq $FunctionName
        }
    )

    if ($indexMatches.Count -eq 0) {
        Write-Host "[NOT FOUND] Function not present in MACS FunctionIndex."
    }
    else {
        $indexMatches | Format-List *
    }

    if (Test-Path -LiteralPath $graphPath) {
        Write-Section "Dependency Graph References"
        $graphText = Get-Content -LiteralPath $graphPath -Raw
        $hits = $graphText -split "`n" | Select-String -Pattern ([regex]::Escape($FunctionName))

        if ($hits) {
            $hits | Select-Object -First 100
        }
        else {
            Write-Host "No dependency graph reference found."
        }
    }
}

function Open-GitHubForFile {
    param([string]$Term, [array]$Files)

    $matches = @(
        $Files |
        Where-Object {
            $_.Name -like "*$Term*"
        }
    )

    if ($matches.Count -eq 0) {
        Write-Host "[NOT FOUND] File not found."
        return
    }

    foreach ($file in $matches) {
        $relative = (Make-RelativePath $RepositoryRoot $file.FullName).Replace("\", "/")
        Write-Host "https://github.com/BrokerMGR/MelroseOS/blob/main/$relative"
    }

    $answer = Read-Host "Open first GitHub match? (Y/N)"

    if ($answer.Trim().ToUpperInvariant() -eq "Y") {
        $relative = (Make-RelativePath $RepositoryRoot $matches[0].FullName).Replace("\", "/")
        Start-Process "https://github.com/BrokerMGR/MelroseOS/blob/main/$relative"
    }
}

if (-not (Test-Path -LiteralPath $RepositoryRoot)) {
    throw "Repository root not found: $RepositoryRoot"
}

while ($true) {
    # Refresh mappings/files on every menu cycle so newly registered projects appear immediately.
    $projects = Get-ClaspProjects -Root $RepositoryRoot
    $files = Get-SearchableFiles -Root $RepositoryRoot

    Clear-Host

    Write-Host ""
    Write-Host "MelroseOS Developer Navigator v3.1.0"
    Write-Host "===================================="
    Write-Host ""
    Write-Host " 1. Locate function declaration"
    Write-Host " 2. Search any text / constant / variable / sheet name"
    Write-Host " 3. Locate file"
    Write-Host " 4. List or open Apps Script projects"
    Write-Host " 5. Search Script ID / Parent Sheet ID"
    Write-Host " 6. Show function dependencies from MACS"
    Write-Host " 7. Show likely real missing functions"
    Write-Host " 8. Show duplicate function declarations"
    Write-Host " 9. Show project health"
    Write-Host "10. Show production readiness"
    Write-Host "11. Show dependency heatmap"
    Write-Host "12. Open GitHub source file"
    Write-Host "13. Show all clasp mappings"
    Write-Host "14. Search everything"
    Write-Host " 0. Exit"
    Write-Host ""

    $choice = Read-Host "Choose an option"

    switch ($choice) {
        "1" {
            $name = Read-Host "Function name"
            Search-Function -Name $name.Trim() -Files $files -Projects $projects
            Read-Host "Press Enter to continue"
        }
        "2" {
            $term = Read-Host "Text, constant, variable, sheet, trigger, ID, etc."
            Search-Text -Term $term.Trim() -Files $files -Projects $projects
            Read-Host "Press Enter to continue"
        }
        "3" {
            $term = Read-Host "File name or partial file name"
            Search-FileName -Term $term.Trim() -Files $files -Projects $projects
            Read-Host "Press Enter to continue"
        }
        "4" {
            Show-Projects -Projects $projects
            Read-Host "Press Enter to continue"
        }
        "5" {
            $term = Read-Host "Script ID or Parent ID"
            Search-ScriptId -Term $term.Trim() -Projects $projects
            Read-Host "Press Enter to continue"
        }
        "6" {
            $term = Read-Host "Function name"
            Show-FunctionDependencies -FunctionName $term.Trim()
            Read-Host "Press Enter to continue"
        }
        "7" {
            Show-MacsReport -ReportName "LikelyRealMissingFunctions.json"
            Read-Host "Press Enter to continue"
        }
        "8" {
            Show-MacsReport -ReportName "DuplicateFunctionDeclarations.json"
            Read-Host "Press Enter to continue"
        }
        "9" {
            Show-MacsReport -ReportName "ProjectHealth.json"
            Read-Host "Press Enter to continue"
        }
        "10" {
            Show-MacsReport -ReportName "ProductionReadiness.json"
            Read-Host "Press Enter to continue"
        }
        "11" {
            Show-MacsReport -ReportName "DependencyHeatmap.json"
            Read-Host "Press Enter to continue"
        }
        "12" {
            $term = Read-Host "File name or partial file name"
            Open-GitHubForFile -Term $term.Trim() -Files $files
            Read-Host "Press Enter to continue"
        }
        "13" {
            $projects |
                Select-Object projectName, scriptId, parentId, sourceRoot, projectFolder, appsScriptUrl |
                Format-Table -AutoSize
            Read-Host "Press Enter to continue"
        }
        "14" {
            $term = Read-Host "Search term"
            Write-Section "File Name Matches"
            Search-FileName -Term $term.Trim() -Files $files -Projects $projects
            Write-Section "Text Matches"
            Search-Text -Term $term.Trim() -Files $files -Projects $projects
            Read-Host "Press Enter to continue"
        }
        "0" {
            exit 0
        }
        default {
            Write-Host "Invalid selection."
            Start-Sleep -Seconds 1
        }
    }
}
