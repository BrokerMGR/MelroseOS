<#
==========================================================
MelroseOS Enterprise
Module : LM-008
Name   : Duplicate Detection
Version: 1.0.1
Release: MOS5-016
==========================================================
#>

$ErrorActionPreference = 'Stop'

$Root   = 'D:\MelroseOS\GitHub\MelroseOS'
$Common = Join-Path $Root 'CoreModules\LM-000_Common.ps1'

if (-not (Test-Path -LiteralPath $Common)) {
    Write-Host '[FAIL] LM-000_Common.ps1 not found.' -ForegroundColor Red
    exit 1
}

. $Common

$LMRoot     = Get-MOSLeadMigrationRoot
$Reports    = Join-Path $LMRoot 'Reports'
$InputPath  = Join-Path $Reports 'NormalizedLeads.json'
$OutputPath = Join-Path $Reports 'DuplicateDetection.json'

function Get-MOSDuplicateKey {
    param($Lead)

    if (-not [string]::IsNullOrWhiteSpace([string]$Lead.Fingerprint)) {
        return [string]$Lead.Fingerprint
    }

    $Email   = ([string]$Lead.Email).Trim().ToLowerInvariant()
    $Phone   = ([string]$Lead.Phone) -replace '\D',''
    $Address = ([string]$Lead.PropertyAddress).Trim().ToLowerInvariant()

    return "$Email|$Phone|$Address"
}

function Invoke-MOSDuplicateDetection {

    Write-MOSHeader 'LM-008 Duplicate Detection'

    Test-MOSFolder $Reports | Out-Null

    if (-not (Test-Path -LiteralPath $InputPath)) {
        Write-MOSError "NormalizedLeads.json not found: $InputPath"
        exit 1
    }

    $Data = Get-Content -LiteralPath $InputPath -Raw | ConvertFrom-Json

    $Seen = @{}
    $Rows = @()

    foreach ($Lead in @($Data.leads)) {

        $Key = Get-MOSDuplicateKey $Lead

        $IsDuplicate = $false
        $DuplicateOf = ''

        if ($Seen.ContainsKey($Key)) {
            $IsDuplicate = $true
            $DuplicateOf = [string]$Seen[$Key]
        }
        else {
            $Seen[$Key] = [string]$Lead.MessageId
        }

        $Rows += [pscustomobject]@{
            MessageId            = [string]$Lead.MessageId
            ThreadId             = [string]$Lead.ThreadId
            Fingerprint          = [string]$Lead.Fingerprint
            Email                = [string]$Lead.Email
            Phone                = [string]$Lead.Phone
            PropertyAddress      = [string]$Lead.PropertyAddress
            LeadType             = [string]$Lead.LeadType
            IsDuplicate          = $IsDuplicate
            DuplicateOf          = $DuplicateOf
            RequiresBrokerReview = [bool]($IsDuplicate -or $Lead.RequiresBrokerReview)
        }
    }

    $Report = [ordered]@{
        release            = 'MOS5-016'
        module             = 'LM-008'
        generatedAt        = (Get-Date).ToString('o')
        recordCount        = $Rows.Count
        duplicateCount     = @($Rows | Where-Object { $_.IsDuplicate }).Count
        records            = $Rows
        previewOnly        = $true
        crmWritesEnabled   = $false
        outboundEnabled    = $false
        safetyLock         = 'ENABLED'
        nextModule         = 'LM-009_MergeEngine'
    }

    $Report |
        ConvertTo-Json -Depth 30 |
        Set-Content -LiteralPath $OutputPath -Encoding UTF8

    if (-not (Test-Path -LiteralPath $OutputPath)) {
        Write-MOSError "Duplicate detection report was not created: $OutputPath"
        exit 1
    }

    if ((Get-Item -LiteralPath $OutputPath).Length -le 0) {
        Write-MOSError "Duplicate detection report is empty: $OutputPath"
        exit 1
    }

    Write-Host "Output:"
    Write-Host $OutputPath
    Write-Host ""
    Write-MOSSuccess 'LM-008 Duplicate Detection Ready'
}

Invoke-MOSDuplicateDetection
exit 0
