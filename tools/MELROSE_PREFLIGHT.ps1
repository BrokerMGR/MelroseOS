param(
  [string]$RepositoryRoot = "D:\MelroseOS\GitHub\MelroseOS",
  [switch]$AllowCleanOnly
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path (Join-Path $RepositoryRoot ".git"))) {
  throw "MelroseOS Git repository not found."
}

$KnownStages = @{
  "PROJECTS/CORE/src/D3-02-01_MultiAccountDeploymentRegistry.js" = @{
    Stage = "G2/G3"
    VerifyHint = "Run the matching G2 or G3 VERIFY BAT."
  }
  "PROJECTS/CRM/src/CRM-06_SystemPermissionsManager.js" = @{
    Stage = "G4"
    VerifyHint = "Run 02_VERIFY_G4_RUNTIME_ACL.bat."
  }
  "PROJECTS/ARCHIVE/src/Engine_BackupManager.js" = @{
    Stage = "G5"
    VerifyHint = "Run 02_VERIFY_G5_BACKUP_RUNTIME.bat."
  }
  "PROJECTS/CRM/src/AE-05_EligibilityEngine.js" = @{
    Stage = "M1A"
    VerifyHint = "Run 02_VERIFY_M1A_ELIGIBILITY_GUARD.bat."
  }
}

Push-Location $RepositoryRoot
try {
  $status = git status --porcelain

  if ($LASTEXITCODE -ne 0) {
    throw "Unable to read Git status."
  }

  if (-not $status) {
    Write-Host "[PASS] Repository is clean."
    exit 0
  }

  Write-Host ""
  Write-Host "Repository changes detected:"
  Write-Host "------------------------------------------------------------"
  git status --short
  Write-Host "------------------------------------------------------------"

  $changedPaths = @()

  foreach ($line in $status) {
    if ($line.Length -ge 4) {
      $path = $line.Substring(3).Trim()
      $changedPaths += $path
    }
  }

  $known = @()
  $unknown = @()

  foreach ($path in $changedPaths) {
    if ($KnownStages.ContainsKey($path)) {
      $known += [pscustomobject]@{
        Path = $path
        Stage = $KnownStages[$path].Stage
        VerifyHint = $KnownStages[$path].VerifyHint
      }
    } else {
      $unknown += $path
    }
  }

  if ($unknown.Count -gt 0) {
    Write-Host ""
    Write-Host "[BLOCKED] Unknown or unrelated changes are present:"
    foreach ($item in $unknown) {
      Write-Host (" - " + $item)
    }
    Write-Host ""
    Write-Host "Review these changes manually before continuing."
    exit 2
  }

  if ($known.Count -ne 1) {
    Write-Host ""
    Write-Host "[BLOCKED] More than one recognized stage is pending."
    Write-Host "Commit each stage separately to preserve clean rollback points."
    exit 3
  }

  $stage = $known[0]

  Write-Host ""
  Write-Host ("Detected pending stage: " + $stage.Stage)
  Write-Host ("Changed file: " + $stage.Path)
  Write-Host ("Verifier: " + $stage.VerifyHint)
  Write-Host ""

  if ($AllowCleanOnly) {
    Write-Host "[BLOCKED] Repository must be clean for this operation."
    exit 4
  }

  Write-Host "Choose an action:"
  Write-Host "  1. Show full diff"
  Write-Host "  2. Commit and push the verified stage"
  Write-Host "  3. Show status only"
  Write-Host "  4. Exit without changes"
  Write-Host ""

  $choice = Read-Host "Selection"

  switch ($choice) {
    "1" {
      git diff -- $stage.Path
      exit 5
    }

    "2" {
      $confirmation = Read-Host ("Confirm that " + $stage.Stage + " verification PASSED? Type YES")

      if ($confirmation -ne "YES") {
        Write-Host "[CANCELLED] No Git changes made."
        exit 6
      }

      $messages = @{
        "G2/G3" = "Guardrail: Commit verified account and vault runtime changes"
        "G4" = "G4: Add runtime ACL enforcement"
        "G5" = "G5: Add backup runtime integration"
        "M1A" = "M1A: Add canonical eligibility guard"
      }

      $message = $messages[$stage.Stage]

      git add -- $stage.Path
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

      $remaining = git status --porcelain

      if ($remaining) {
        Write-Host "[WARNING] Commit succeeded, but the repository is still not clean."
        git status --short
        exit 7
      }

      Write-Host "[SUCCESS] Verified stage committed and pushed."
      exit 0
    }

    "3" {
      git status
      exit 8
    }

    default {
      Write-Host "[EXIT] No changes made."
      exit 9
    }
  }
}
finally {
  Pop-Location
}
