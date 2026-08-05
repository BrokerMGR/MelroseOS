param(
  [string]$RepositoryRoot = "D:\MelroseOS\GitHub\MelroseOS"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path (Join-Path $RepositoryRoot ".git"))) {
  throw "MelroseOS Git repository not found."
}

function Get-SuggestedCommitMessage([string[]]$Paths) {
  $joined = ($Paths -join " ").ToUpperInvariant()

  if ($joined -match "LI-01_CORE") {
    return "M1B: Add cross-project safety gate"
  }

  if ($joined -match "LI-06_INTAKEROUTER") {
    return "M1C: Add canonical lead intake entry point"
  }

  if ($joined -match "AE-05_ELIGIBILITYENGINE") {
    return "M1A: Add canonical eligibility guard"
  }

  if ($joined -match "CRM-06_SYSTEMPERMISSIONSMANAGER") {
    return "G4: Add runtime ACL enforcement"
  }

  if ($joined -match "ENGINE_BACKUPMANAGER") {
    return "G5: Add backup runtime integration"
  }

  if ($joined -match "D3-02-01_MULTIACCOUNTDEPLOYMENTREGISTRY") {
    return "Guardrail: Update account and vault runtime controls"
  }

  if ($joined -match "^TOOLS/| TOOLS/") {
    return "Tooling: Update MelroseOS development tools"
  }

  return "MelroseOS: Commit verified stage"
}

Push-Location $RepositoryRoot

try {
  $statusLines = @(git status --porcelain)

  if ($LASTEXITCODE -ne 0) {
    throw "Unable to read Git status."
  }

  if ($statusLines.Count -eq 0) {
    Write-Host "[PASS] Repository is clean."
    Write-Host "You may run the next APPLY BAT."
    exit 0
  }

  $entries = @()

  foreach ($line in $statusLines) {
    if (-not $line) {
      continue
    }

    $statusCode = $line.Substring(0, 2)
    $path = $line.Substring(3).Trim()

    $entries += [pscustomobject]@{
      Status = $statusCode
      Path = $path
    }
  }

  Write-Host ""
  Write-Host "Repository changes detected:"
  Write-Host "------------------------------------------------------------"
  git status --short
  Write-Host "------------------------------------------------------------"

  $conflictEntries = @(
    $entries | Where-Object {
      $_.Status -match "U|AA|DD|AU|UA|DU|UD"
    }
  )

  if ($conflictEntries.Count -gt 0) {
    Write-Host ""
    Write-Host "[BLOCKED] Git merge conflicts are present."
    Write-Host "Resolve conflicts before continuing."
    exit 20
  }

  $projectGroups = @(
    $entries |
    ForEach-Object {
      if ($_.Path -match "^PROJECTS/([^/]+)/") {
        $Matches[1].ToUpperInvariant()
      }
      elseif ($_.Path -match "^tools/") {
        "TOOLS"
      }
      elseif ($_.Path -match "^docs/") {
        "DOCS"
      }
      else {
        "OTHER"
      }
    } |
    Select-Object -Unique
  )

  if ($projectGroups.Count -gt 1) {
    Write-Host ""
    Write-Host "[BLOCKED] Changes span multiple areas:"
    foreach ($group in $projectGroups) {
      Write-Host (" - " + $group)
    }
    Write-Host ""
    Write-Host "Commit one completed stage at a time."
    exit 21
  }

  $paths = @($entries.Path)
  $message = Get-SuggestedCommitMessage -Paths $paths

  Write-Host ""
  Write-Host ("Detected area: " + $projectGroups[0])
  Write-Host ("Changed files: " + $paths.Count)
  Write-Host ("Suggested commit message: " + $message)
  Write-Host ""
  Write-Host "Choose an action:"
  Write-Host "  1. Show full diff"
  Write-Host "  2. Commit and push verified changes"
  Write-Host "  3. Restore all uncommitted changes"
  Write-Host "  4. Show detailed Git status"
  Write-Host "  5. Exit"
  Write-Host ""

  $choice = Read-Host "Selection"

  switch ($choice) {
    "1" {
      git diff
      exit 10
    }

    "2" {
      $verified = Read-Host "Did the matching VERIFY BAT pass? Type YES"

      if ($verified -ne "YES") {
        Write-Host "[CANCELLED] Verification was not confirmed."
        exit 11
      }

      $custom = Read-Host "Press Enter to use the suggested commit message, or type a custom message"

      if ($custom) {
        $message = $custom
      }

      git add --all

      if ($LASTEXITCODE -ne 0) {
        throw "git add failed."
      }

      git commit -m $message

      if ($LASTEXITCODE -ne 0) {
        throw "git commit failed."
      }

      git push

      if ($LASTEXITCODE -ne 0) {
        throw "git push failed."
      }

      $remaining = @(git status --porcelain)

      if ($remaining.Count -gt 0) {
        Write-Host "[WARNING] Commit and push completed, but changes remain:"
        git status --short
        exit 12
      }

      Write-Host "[SUCCESS] Verified changes committed and pushed."
      Write-Host "Repository is clean."
      exit 0
    }

    "3" {
      Write-Host ""
      Write-Host "WARNING: This will discard ALL uncommitted changes shown above."
      $confirm = Read-Host "Type RESTORE to continue"

      if ($confirm -ne "RESTORE") {
        Write-Host "[CANCELLED] No files were restored."
        exit 13
      }

      git restore --staged .
      git restore .
      git clean -fd

      if ($LASTEXITCODE -ne 0) {
        throw "Restore operation failed."
      }

      Write-Host "[SUCCESS] Uncommitted changes were discarded."
      exit 0
    }

    "4" {
      git status
      exit 14
    }

    default {
      Write-Host "[EXIT] No changes made."
      exit 15
    }
  }
}
finally {
  Pop-Location
}
