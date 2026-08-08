$ErrorActionPreference = "Stop"

$Reports = Join-Path $PSScriptRoot "reports"

if (!(Test-Path -LiteralPath $Reports)) {
    New-Item -ItemType Directory -Path $Reports -Force | Out-Null
}

$Mailboxes = @(
    "melrosegroupbroker@gmail.com",
    "melrosegrouprealty@gmail.com",
    "agentleadcentral@gmail.com",
    "melrosegroupstaff@gmail.com",
    "melrosegroupleads@gmail.com"
)

$Results = @()

foreach ($Mailbox in $Mailboxes) {
    $Results += [pscustomobject]@{
        Mailbox = $Mailbox
        Connected = $false
        DiscoveryMode = "PREVIEW"
        CandidateLeadMessages = 0
        LabelCount = 0
        LastScan = $null
        Status = "READY"
    }
}

$Out = Join-Path $Reports "MailboxDiscovery.json"

[ordered]@{
    subsystem = "LEAD_MIGRATION"
    release = "MOS5-016-S1A-B1"
    generatedAt = (Get-Date).ToString("o")
    previewOnly = $true
    outboundBlocked = $true
    mailboxCount = $Results.Count
    mailboxes = $Results
} |
ConvertTo-Json -Depth 10 |
Set-Content -LiteralPath $Out -Encoding UTF8

Write-Host ""
Write-Host "Mailbox Discovery"
Write-Host "================="
Write-Host ""

$Results | Format-Table Mailbox,Connected,DiscoveryMode,Status -AutoSize

Write-Host ""
Write-Host "Report:"
Write-Host $Out
Write-Host ""
Write-Host "[PASS]"
