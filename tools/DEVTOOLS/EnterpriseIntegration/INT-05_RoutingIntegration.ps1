$ErrorActionPreference = "Stop"

$Repo = (Resolve-Path "$PSScriptRoot\..\..\..").Path
$Reports = Join-Path $PSScriptRoot "reports"

if (!(Test-Path $Reports)) {
    New-Item -ItemType Directory -Path $Reports -Force | Out-Null
}

$ProjectsRoot = Join-Path $Repo "PROJECTS"

$Required = @(
    "CRM",
    "INTAKE",
    "CORE"
)

$Checks = @()

foreach ($Project in $Required) {

    $ProjectPath =
        Join-Path `
            $ProjectsRoot `
            $Project

    $Checks += [pscustomobject]@{
        Check = "$Project project exists"
        Passed = Test-Path -LiteralPath $ProjectPath
    }

}

$IntakeAssignment =
    Join-Path `
        $ProjectsRoot `
        "INTAKE\src\INTAKE-70_AssignmentEngine.js"

$IntakeOwnership =
    Join-Path `
        $ProjectsRoot `
        "INTAKE\src\INTAKE-64_AgentOwnershipResolver.js"

$IntakeLocation =
    Join-Path `
        $ProjectsRoot `
        "INTAKE\src\INTAKE-65_ParishLocationResolver.js"

$Checks += [pscustomobject]@{
    Check = "Assignment Engine"
    Passed = Test-Path -LiteralPath $IntakeAssignment
}

$Checks += [pscustomobject]@{
    Check = "Ownership Resolver"
    Passed = Test-Path -LiteralPath $IntakeOwnership
}

$Checks += [pscustomobject]@{
    Check = "Parish Resolver"
    Passed = Test-Path -LiteralPath $IntakeLocation
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
        "RoutingIntegration.json"

[ordered]@{
    generatedAt = (Get-Date).ToString("o")
    passed = $Passed
    failed = $Failed
    status = if ($Failed -eq 0) { "PASS" } else { "FAIL" }
    productionRoutingAllowed = $false
    roundRobinAllowed = $false
    brokerOnlyProtectionRequired = $true
    ownershipLocksRequired = $true
    checks = $Checks
} |
ConvertTo-Json -Depth 10 |
Set-Content -LiteralPath $Out -Encoding UTF8

Write-Host ""
Write-Host "Enterprise Routing Integration"
Write-Host "=============================="
Write-Host ""

$Checks |
    Format-Table Check,Passed -AutoSize

Write-Host ""
Write-Host "Passed : $Passed"
Write-Host "Failed : $Failed"
Write-Host "Production Routing : BLOCKED"
Write-Host ""

if ($Failed -eq 0) {
    Write-Host "[PASS]"
    exit 0
}

Write-Host "[FAIL]"
exit 1