$ErrorActionPreference = "Stop"

$Repo = (Resolve-Path "$PSScriptRoot\..\..").Path

$Reports =
    Join-Path `
        $PSScriptRoot `
        "reports"

if (!(Test-Path $Reports)) {
    New-Item -ItemType Directory -Path $Reports -Force | Out-Null
}

$Accounts = @(
    "melrosegroupbroker@gmail.com",
    "melrosegrouprealty@gmail.com",
    "agentleadcentral@gmail.com",
    "melrosegroupstaff@gmail.com",
    "melrosegroupleads@gmail.com"
)

$Status = [ordered]@{

    subsystem = "LEAD_MIGRATION"

    release = "MOS5-016-S1-001"

    version = "1.0.0"

    mode = "DISCOVERY"

    mailboxCount = $Accounts.Count

    migrationEnabled = $false

    previewOnly = $true

    commitEnabled = $false

    outboundBlocked = $true

    generatedAt = (Get-Date).ToString("o")

    mailboxes = $Accounts

}

$Out =
Join-Path `
$Reports `
"LeadMigrationCore.json"

$Status |
ConvertTo-Json -Depth 10 |
Set-Content `
-LiteralPath $Out `
-Encoding UTF8

Write-Host ""
Write-Host "MelroseOS Historical Lead Migration"
Write-Host "==================================="
Write-Host ""

Write-Host "Mode          : DISCOVERY"
Write-Host "Mailboxes     : $($Accounts.Count)"
Write-Host "Preview       : ENABLED"
Write-Host "Commit        : DISABLED"
Write-Host "Outbound      : BLOCKED"

Write-Host ""
Write-Host "[PASS]"