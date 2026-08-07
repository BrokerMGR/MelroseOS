$ErrorActionPreference = "Stop"

$ReportRoot = Join-Path $PSScriptRoot "reports"
$Inventory = Join-Path $ReportRoot "TriggerInventory.csv"

if (!(Test-Path $Inventory)) {
    Write-Host "[FAIL] TriggerInventory.csv not found."
    exit 1
}

$Rows = Import-Csv $Inventory

$Duplicates =
    $Rows |
    Group-Object Project,ScriptId |
    Where-Object {
        $_.Count -gt 1
    }

Write-Host ""
Write-Host "MelroseOS Trigger Duplicate Detector"
Write-Host "===================================="
Write-Host ""

if ($Duplicates.Count -eq 0) {
    Write-Host "[PASS] No duplicate project mappings detected."
    exit 0
}

foreach ($Group in $Duplicates) {

    Write-Host ""
    Write-Host "Duplicate:"
    Write-Host $Group.Name
    Write-Host "Count: $($Group.Count)"

    $Group.Group |
        Format-Table -AutoSize

}

$Out =
    Join-Path `
        $ReportRoot `
        "DuplicateTriggers.json"

$Duplicates |
    ForEach-Object {

        [pscustomobject]@{
            Key = $_.Name
            Count = $_.Count
            Entries = $_.Group
        }

    } |
    ConvertTo-Json -Depth 10 |
    Set-Content `
        -LiteralPath $Out `
        -Encoding UTF8

Write-Host ""
Write-Host "[WARNING] Duplicate mappings detected."
Write-Host $Out