$ErrorActionPreference = "Stop"

$Repo = (Resolve-Path "$PSScriptRoot\..\..\..").Path
$Reports = Join-Path $PSScriptRoot "reports"
$Projects = Join-Path $Repo "PROJECTS"

if (!(Test-Path $Reports)) {
    New-Item -ItemType Directory -Path $Reports -Force | Out-Null
}

$Checks = @()

$RequiredFiles = @(
    @{
        Name = "INTAKE Historical Scanner"
        Path = "INTAKE\src\INTAKE-54_HistoricalMailboxScanner.js"
    },
    @{
        Name = "INTAKE Backfill Engine"
        Path = "INTAKE\src\INTAKE-32_BackfillEngine.js"
    },
    @{
        Name = "INTAKE Backfill Queue"
        Path = "INTAKE\src\INTAKE-47_BackfillQueue.js"
    },
    @{
        Name = "INTAKE Deduplication"
        Path = "INTAKE\src\INTAKE-38_DeduplicationEngine.js"
    },
    @{
        Name = "INTAKE CRM Matcher"
        Path = "INTAKE\src\INTAKE-63_ExistingCRMMatcher.js"
    },
    @{
        Name = "INTAKE Ownership Resolver"
        Path = "INTAKE\src\INTAKE-64_AgentOwnershipResolver.js"
    },
    @{
        Name = "INTAKE Safety Gate"
        Path = "INTAKE\src\INTAKE-09_SafetyGate.js"
    }
)

foreach ($Item in $RequiredFiles) {

    $FullPath =
        Join-Path `
            $Projects `
            $Item.Path

    $Checks += [pscustomobject]@{
        Check = $Item.Name
        Passed = Test-Path -LiteralPath $FullPath
        Path = $FullPath
    }

}

$ProductionGate =
    Join-Path `
        $Repo `
        "tools\DEVTOOLS\ProductionGate\reports\ProductionGateMaster.json"

$Checks += [pscustomobject]@{
    Check = "Production Gate Report"
    Passed = Test-Path -LiteralPath $ProductionGate
    Path = $ProductionGate
}

$Passed =
    @(
        $Checks |
        Where-Object {
            $_.Passed
        }
    ).Count

$Failed =
    @(
        $Checks |
        Where-Object {
            -not $_.Passed
        }
    ).Count

$Out =
    Join-Path `
        $Reports `
        "HistoricalImportReadiness.json"

[ordered]@{
    subsystem = "ENTERPRISE_INTEGRATION"
    release = "MOS5-015-INT-008"
    generatedAt = (Get-Date).ToString("o")
    passed = $Passed
    failed = $Failed
    status = if ($Failed -eq 0) { "PASS" } else { "FAIL" }
    historicalImportAllowed = ($Failed -eq 0)
    liveRoutingAllowed = $false
    outboundCommunicationsAllowed = $false
    ownershipLocksRequired = $true
    duplicateProtectionRequired = $true
    checks = $Checks
} |
ConvertTo-Json -Depth 10 |
Set-Content -LiteralPath $Out -Encoding UTF8

Write-Host ""
Write-Host "Historical Import Readiness"
Write-Host "==========================="
Write-Host ""

$Checks |
    Format-Table Check,Passed -AutoSize

Write-Host ""
Write-Host "Passed : $Passed"
Write-Host "Failed : $Failed"
Write-Host "Live Routing : BLOCKED"
Write-Host "Outbound     : BLOCKED"
Write-Host ""

if ($Failed -eq 0) {
    Write-Host "[PASS]"
    exit 0
}

Write-Host "[FAIL]"
exit 1