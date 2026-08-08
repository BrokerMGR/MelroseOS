$ErrorActionPreference = "Stop"

$Reports = Join-Path $PSScriptRoot "reports"

if (!(Test-Path -LiteralPath $Reports)) {
    New-Item -ItemType Directory -Path $Reports -Force | Out-Null
}

$Sources = @(
    [pscustomobject]@{ Source="RECRUITING"; BrokerOnly=$true; Assignable=$false; Priority=1 },
    [pscustomobject]@{ Source="CLEVER"; BrokerOnly=$true; Assignable=$false; Priority=1 },
    [pscustomobject]@{ Source="POPTIN"; BrokerOnly=$true; Assignable=$false; Priority=1 },
    [pscustomobject]@{ Source="INTERNAL_AGENT"; BrokerOnly=$true; Assignable=$false; Priority=1 },
    [pscustomobject]@{ Source="WEBSITE"; BrokerOnly=$false; Assignable=$true; Priority=2 },
    [pscustomobject]@{ Source="FACEBOOK"; BrokerOnly=$false; Assignable=$true; Priority=2 },
    [pscustomobject]@{ Source="ZILLOW"; BrokerOnly=$false; Assignable=$true; Priority=2 },
    [pscustomobject]@{ Source="REALTOR_COM"; BrokerOnly=$false; Assignable=$true; Priority=2 },
    [pscustomobject]@{ Source="HOMES_COM"; BrokerOnly=$false; Assignable=$true; Priority=2 },
    [pscustomobject]@{ Source="MANUAL"; BrokerOnly=$false; Assignable=$true; Priority=2 },
    [pscustomobject]@{ Source="UNKNOWN"; BrokerOnly=$true; Assignable=$false; Priority=9 }
)

$Out = Join-Path $Reports "SourceInventory.json"

[ordered]@{
    subsystem = "LEAD_MIGRATION"
    release = "MOS5-016-S1A-B1"
    generatedAt = (Get-Date).ToString("o")
    sources = $Sources
    preserveExistingOwnership = $true
    preserveManualAssignments = $true
} |
ConvertTo-Json -Depth 10 |
Set-Content -LiteralPath $Out -Encoding UTF8

Write-Host ""
Write-Host "Source Inventory"
Write-Host "================"
Write-Host ""

$Sources | Format-Table Source,BrokerOnly,Assignable,Priority -AutoSize

Write-Host ""
Write-Host "Report:"
Write-Host $Out
Write-Host ""
Write-Host "[PASS]"
