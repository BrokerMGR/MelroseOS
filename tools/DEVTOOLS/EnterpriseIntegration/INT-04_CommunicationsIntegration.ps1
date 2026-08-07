$ErrorActionPreference = "Stop"

$Repo = (Resolve-Path "$PSScriptRoot\..\..\..").Path
$Reports = Join-Path $PSScriptRoot "reports"
$ProductionGate = Join-Path $Repo "tools\DEVTOOLS\ProductionGate\reports"

if (!(Test-Path $Reports)) {
    New-Item -ItemType Directory -Path $Reports -Force | Out-Null
}

$SafetyLockPath = Join-Path $ProductionGate "SafetyLock.json"
$OutboundGatePath = Join-Path $ProductionGate "OutboundGate.json"

$SafetyLock = $null
$OutboundGate = $null

if (Test-Path -LiteralPath $SafetyLockPath) {
    $SafetyLock =
        Get-Content -LiteralPath $SafetyLockPath -Raw |
        ConvertFrom-Json
}

if (Test-Path -LiteralPath $OutboundGatePath) {
    $OutboundGate =
        Get-Content -LiteralPath $OutboundGatePath -Raw |
        ConvertFrom-Json
}

$Checks = @()

$Checks += [pscustomobject]@{
    Check = "Safety Lock Report"
    Passed = ($null -ne $SafetyLock)
}

$Checks += [pscustomobject]@{
    Check = "Outbound Gate Report"
    Passed = ($null -ne $OutboundGate)
}

$Checks += [pscustomobject]@{
    Check = "Email Blocked"
    Passed = (
        $null -ne $OutboundGate -and
        $OutboundGate.Gmail -eq $false
    )
}

$Checks += [pscustomobject]@{
    Check = "Replies Blocked"
    Passed = (
        $null -ne $OutboundGate -and
        $OutboundGate.GmailReplies -eq $false
    )
}

$Checks += [pscustomobject]@{
    Check = "Notifications Blocked"
    Passed = (
        $null -ne $SafetyLock -and
        $SafetyLock.Enabled -eq $true
    )
}

$Checks += [pscustomobject]@{
    Check = "External API Posts Blocked"
    Passed = (
        $null -ne $OutboundGate -and
        $OutboundGate.ExternalAPIs -eq $false
    )
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
        "CommunicationsIntegration.json"

[ordered]@{
    generatedAt = (Get-Date).ToString("o")
    passed = $Passed
    failed = $Failed
    status = if ($Failed -eq 0) { "PASS" } else { "FAIL" }
    outboundCommunicationsAllowed = $false
    checks = $Checks
} |
ConvertTo-Json -Depth 10 |
Set-Content -LiteralPath $Out -Encoding UTF8

Write-Host ""
Write-Host "Enterprise Communications Integration"
Write-Host "====================================="
Write-Host ""

$Checks |
    Format-Table Check,Passed -AutoSize

Write-Host ""
Write-Host "Passed : $Passed"
Write-Host "Failed : $Failed"
Write-Host "Outbound Communications : BLOCKED"
Write-Host ""

if ($Failed -eq 0) {
    Write-Host "[PASS]"
    exit 0
}

Write-Host "[FAIL]"
exit 1