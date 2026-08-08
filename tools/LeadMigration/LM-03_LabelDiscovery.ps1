$ErrorActionPreference = "Stop"

$Reports = Join-Path $PSScriptRoot "reports"

if (!(Test-Path -LiteralPath $Reports)) {
    New-Item -ItemType Directory -Path $Reports -Force | Out-Null
}

$InventoryPath = Join-Path $Reports "GmailAccountInventory.json"

if (!(Test-Path -LiteralPath $InventoryPath)) {
    Write-Host "[FAIL] GmailAccountInventory.json is missing."
    exit 1
}

$Inventory = Get-Content -LiteralPath $InventoryPath -Raw | ConvertFrom-Json
$Rows = @()

foreach ($Account in $Inventory.accounts) {
    $Rows += [pscustomobject]@{
        AccountId = $Account.Id
        Mailbox = $Account.Email
        LabelsDiscovered = 0
        Labels = @()
        Mode = "PREVIEW"
        Status = "READY_FOR_CONNECTOR"
    }
}

$Out = Join-Path $Reports "LabelDiscovery.json"

[ordered]@{
    subsystem = "LEAD_MIGRATION"
    release = "MOS5-016-S1A-B1"
    generatedAt = (Get-Date).ToString("o")
    previewOnly = $true
    mailboxes = $Rows
} |
ConvertTo-Json -Depth 10 |
Set-Content -LiteralPath $Out -Encoding UTF8

Write-Host ""
Write-Host "Label Discovery"
Write-Host "==============="
Write-Host ""

$Rows | Format-Table AccountId,Mailbox,LabelsDiscovered,Status -AutoSize

Write-Host ""
Write-Host "Report:"
Write-Host $Out
Write-Host ""
Write-Host "[PASS]"
