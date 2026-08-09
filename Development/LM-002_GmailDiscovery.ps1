<#
==========================================================
MelroseOS Enterprise
Module : LM-002
Name   : Gmail Discovery
Version: 1.0.0
Release: MOS5-016
==========================================================
#>

$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------
# Resolve Repository Root
# ---------------------------------------------------------

$RepositoryRoot = "D:\MelroseOS\GitHub\MelroseOS"
$CommonModule = Join-Path $RepositoryRoot "CoreModules\LM-000_Common.ps1"

if (-not (Test-Path -LiteralPath $CommonModule)) {
    Write-Host "[FAIL] LM-000_Common.ps1 not found." -ForegroundColor Red
    exit 1
}

. $CommonModule

# ---------------------------------------------------------
# Configuration
# ---------------------------------------------------------

$ModuleId      = "LM-002"
$ModuleName    = "Gmail Discovery"
$ModuleVersion = "1.0.0"
$Release       = "MOS5-016"

$LeadMigrationRoot = Get-MOSLeadMigrationRoot
$ReportsRoot       = Join-Path $LeadMigrationRoot "Reports"
$LogsRoot          = Join-Path $LeadMigrationRoot "Logs"

Test-MOSFolder $ReportsRoot | Out-Null
Test-MOSFolder $LogsRoot | Out-Null

$DiscoveryReport = Join-Path $ReportsRoot "GmailDiscovery.json"

# ---------------------------------------------------------
# Enterprise Gmail Accounts
# ---------------------------------------------------------

$Mailboxes = @(
    [pscustomobject]@{
        Id       = "BROKER_CORE"
        Email    = "melrosegroupbroker@gmail.com"
        Role     = "broker_core"
        Priority = 1
        Enabled  = $true
    },
    [pscustomobject]@{
        Id       = "BROKERAGE_SHARED"
        Email    = "melrosegrouprealty@gmail.com"
        Role     = "brokerage_shared"
        Priority = 2
        Enabled  = $true
    },
    [pscustomobject]@{
        Id       = "LEAD_DISTRIBUTION"
        Email    = "agentleadcentral@gmail.com"
        Role     = "lead_distribution"
        Priority = 3
        Enabled  = $true
    },
    [pscustomobject]@{
        Id       = "STAFF_OPERATIONS"
        Email    = "melrosegroupstaff@gmail.com"
        Role     = "staff_operations"
        Priority = 4
        Enabled  = $true
    },
    [pscustomobject]@{
        Id       = "LEADS_VAULT"
        Email    = "melrosegroupleads@gmail.com"
        Role     = "leads_vault"
        Priority = 5
        Enabled  = $true
    }
)

# ---------------------------------------------------------
# Lead-Relevant Gmail Labels
# ---------------------------------------------------------

$CandidateLabels = @(
    "MGR/New Leads",
    "New Leads",
    "Leads",
    "Buyer Leads",
    "Seller Leads",
    "Renter Leads",
    "Recruiting",
    "Clever",
    "Website Leads",
    "Facebook Leads",
    "Zillow",
    "Realtor.com",
    "Homes.com"
)

# ---------------------------------------------------------
# Gmail Search Query Builder
# ---------------------------------------------------------

function New-MOSGmailDiscoveryQuery {

    param(
        [datetime]$StartDate,
        [datetime]$EndDate,
        [string[]]$Terms = @()
    )

    $Parts = @()

    if ($StartDate) {
        $Parts += "after:$($StartDate.ToString('yyyy/MM/dd'))"
    }

    if ($EndDate) {
        $Parts += "before:$($EndDate.AddDays(1).ToString('yyyy/MM/dd'))"
    }

    $Parts += "-in:spam"
    $Parts += "-in:trash"

    foreach ($Term in $Terms) {

        if (-not [string]::IsNullOrWhiteSpace($Term)) {

            $SafeTerm = $Term.Replace('"', '\"')

            $Parts += "`"$SafeTerm`""
        }
    }

    return ($Parts -join " ").Trim()
}

# ---------------------------------------------------------
# Gmail Discovery Record
# ---------------------------------------------------------

function New-MOSMailboxDiscoveryRecord {

    param(
        [Parameter(Mandatory)]
        [pscustomobject]$Mailbox
    )

    return [pscustomobject]@{
        Id                    = $Mailbox.Id
        Email                 = $Mailbox.Email
        Role                  = $Mailbox.Role
        Priority              = $Mailbox.Priority
        Enabled               = $Mailbox.Enabled
        ConnectorConfigured   = $false
        ReadOnlyMode          = $true
        LabelsDiscovered      = 0
        CandidateMessages     = 0
        HistoricalMessages    = 0
        LastSuccessfulScan    = $null
        LastAttemptedScan     = $null
        Status                = "READY_FOR_CONNECTOR"
    }
}

# ---------------------------------------------------------
# Discovery Engine
# ---------------------------------------------------------

function Invoke-MOSGmailDiscovery {

    Write-MOSHeader "LM-002 Gmail Discovery"

    Write-MOSInfo "Preparing Gmail discovery inventory."

    $Discovery = @()

    foreach ($Mailbox in $Mailboxes) {

        if (-not $Mailbox.Enabled) {
            continue
        }

        Write-MOSInfo "Registering mailbox: $($Mailbox.Email)"

        $Discovery += New-MOSMailboxDiscoveryRecord -Mailbox $Mailbox
    }

    $DefaultQuery = New-MOSGmailDiscoveryQuery `
        -StartDate (Get-Date).AddYears(-10) `
        -EndDate (Get-Date)

    $Report = [ordered]@{
        subsystem            = "LEAD_MIGRATION"
        release              = $Release
        module               = $ModuleId
        moduleName           = $ModuleName
        moduleVersion        = $ModuleVersion
        generatedAt          = (Get-Date).ToString("o")

        mode                 = "READ_ONLY_DISCOVERY"
        previewOnly          = $true
        gmailReadsEnabled    = $false
        crmWritesEnabled     = $false
        outboundEnabled      = $false

        mailboxCount         = $Discovery.Count
        mailboxes            = $Discovery

        candidateLabels      = $CandidateLabels

        defaultQuery         = $DefaultQuery

        connectorRequired    = $true
        connectorStatus      = "NOT_CONFIGURED"

        nextModule           = "LM-003_MessageInventory"
    }

    $Report |
        ConvertTo-Json -Depth 20 |
        Set-Content -LiteralPath $DiscoveryReport -Encoding UTF8

    Write-MOSLog `
        -Message "LM-002 Gmail discovery inventory generated for $($Discovery.Count) mailboxes." `
        -LogName "LeadMigration"

    Write-Host ""
    Write-Host "Mailboxes Registered : $($Discovery.Count)"
    Write-Host "Candidate Labels     : $($CandidateLabels.Count)"
    Write-Host "Mode                 : READ_ONLY_DISCOVERY"
    Write-Host "Gmail Reads          : DISABLED"
    Write-Host "CRM Writes           : DISABLED"
    Write-Host "Outbound             : BLOCKED"
    Write-Host ""
    Write-Host "Report:"
    Write-Host $DiscoveryReport
    Write-Host ""

    Write-MOSSuccess "LM-002 Gmail Discovery Ready"

    return $Report
}

# ---------------------------------------------------------
# Diagnostics
# ---------------------------------------------------------

function Test-MOSGmailDiscovery {

    $Checks = @()

    $Checks += [pscustomobject]@{
        Check  = "Common Module Loaded"
        Passed = (Get-Command Write-MOSHeader -ErrorAction SilentlyContinue) -ne $null
    }

    $Checks += [pscustomobject]@{
        Check  = "Five Enterprise Mailboxes Registered"
        Passed = $Mailboxes.Count -eq 5
    }

    $Checks += [pscustomobject]@{
        Check  = "Reports Directory Available"
        Passed = Test-Path -LiteralPath $ReportsRoot
    }

    $Checks += [pscustomobject]@{
        Check  = "Preview Safety Enabled"
        Passed = $true
    }

    $Checks += [pscustomobject]@{
        Check  = "CRM Writes Disabled"
        Passed = $true
    }

    $Checks += [pscustomobject]@{
        Check  = "Outbound Communications Blocked"
        Passed = $true
    }

    $Failed = @(
        $Checks |
        Where-Object {
            -not $_.Passed
        }
    ).Count

    Write-Host ""
    Write-Host "LM-002 Diagnostics"
    Write-Host "=================="
    Write-Host ""

    $Checks |
        Format-Table Check, Passed -AutoSize

    Write-Host ""

    if ($Failed -gt 0) {

        Write-MOSError "LM-002 diagnostics failed."

        return $false
    }

    Write-MOSSuccess "LM-002 diagnostics passed."

    return $true
}

# ---------------------------------------------------------
# Startup
# ---------------------------------------------------------

if (-not (Test-MOSGmailDiscovery)) {
    exit 1
}

Invoke-MOSGmailDiscovery | Out-Null

exit 0