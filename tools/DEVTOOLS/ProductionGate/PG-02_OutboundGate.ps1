$ErrorActionPreference = "Stop"

$Reports = Join-Path $PSScriptRoot "reports"

if (!(Test-Path $Reports)) {
    New-Item -ItemType Directory -Path $Reports -Force | Out-Null
}

$Gate = [ordered]@{

    Gmail = $false

    GmailReplies = $false

    SMS = $false

    Voice = $false

    Webhooks = $false

    ExternalAPIs = $false

    CRMWrites = $false

    RoundRobin = $false

    TriggerCreation = $false

    TriggerDeletion = $false

    LiveMonitoring = $false

    HistoricalImport = $false

    LastUpdated = (Get-Date).ToString("o")

}

$Out =
    Join-Path `
        $Reports `
        "OutboundGate.json"

$Gate |
    ConvertTo-Json -Depth 5 |
    Set-Content `
        -LiteralPath $Out `
        -Encoding UTF8

Write-Host ""
Write-Host "MelroseOS Outbound Production Gate"
Write-Host "=================================="
Write-Host ""

$Gate.GetEnumerator() |
Where-Object {
    $_.Key -ne "LastUpdated"
} |
ForEach-Object {

    Write-Host (
        "{0,-20} BLOCKED" -f $_.Key
    )

}

Write-Host ""
Write-Host "Report:"
Write-Host $Out
Write-Host ""
Write-Host "[PASS]"