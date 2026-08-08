$ErrorActionPreference = "Stop"

$Reports = Join-Path $PSScriptRoot "reports"

if (!(Test-Path -LiteralPath $Reports)) {
    New-Item -ItemType Directory -Path $Reports -Force | Out-Null
}

$Accounts = @(
    [pscustomobject]@{ Id="BROKER"; Email="melrosegroupbroker@gmail.com"; Role="broker_core"; Priority=1; Enabled=$true },
    [pscustomobject]@{ Id="BROKERAGE"; Email="melrosegrouprealty@gmail.com"; Role="brokerage_shared"; Priority=2; Enabled=$true },
    [pscustomobject]@{ Id="LEAD_DISTRIBUTION"; Email="agentleadcentral@gmail.com"; Role="lead_distribution"; Priority=3; Enabled=$true },
    [pscustomobject]@{ Id="STAFF"; Email="melrosegroupstaff@gmail.com"; Role="staff_operations"; Priority=4; Enabled=$true },
    [pscustomobject]@{ Id="LEADS_VAULT"; Email="melrosegroupleads@gmail.com"; Role="leads_vault"; Priority=5; Enabled=$true }
)

$Out = Join-Path $Reports "GmailAccountInventory.json"

[ordered]@{
    subsystem = "LEAD_MIGRATION"
    release = "MOS5-016-S1A-B1"
    generatedAt = (Get-Date).ToString("o")
    accountCount = $Accounts.Count
    accounts = $Accounts
} |
ConvertTo-Json -Depth 10 |
Set-Content -LiteralPath $Out -Encoding UTF8

Write-Host ""
Write-Host "Gmail Account Inventory"
Write-Host "======================="
Write-Host ""

$Accounts | Format-Table Id,Email,Role,Priority,Enabled -AutoSize

Write-Host ""
Write-Host "Report:"
Write-Host $Out
Write-Host ""
Write-Host "[PASS]"
