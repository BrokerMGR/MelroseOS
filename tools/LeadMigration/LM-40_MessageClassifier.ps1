param(
    [Parameter(Mandatory=$true)]
    [string]$InputPath,

    [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"

if (!(Test-Path -LiteralPath $InputPath)) {
    throw "Input file not found: $InputPath"
}

$BodyData =
    Get-Content -LiteralPath $InputPath -Raw |
    ConvertFrom-Json

$Rules = @(
    [pscustomobject]@{
        Type = "RECRUITING"
        BrokerOnly = $true
        Terms = @(
            "join the team",
            "join our team",
            "career",
            "real estate license",
            "broker sponsorship",
            "sponsoring broker",
            "new agent",
            "realtor opportunity"
        )
    },
    [pscustomobject]@{
        Type = "SELLER"
        BrokerOnly = $false
        Terms = @(
            "sell my home",
            "selling my home",
            "list my home",
            "home value",
            "property value",
            "listing appointment",
            "seller lead"
        )
    },
    [pscustomobject]@{
        Type = "BUYER"
        BrokerOnly = $false
        Terms = @(
            "buy a home",
            "buying a home",
            "home search",
            "buyer lead",
            "pre-approved",
            "preapproved",
            "mortgage approval"
        )
    },
    [pscustomobject]@{
        Type = "RENTER"
        BrokerOnly = $false
        Terms = @(
            "rental",
            "rent a home",
            "lease",
            "tenant",
            "apartment",
            "renter"
        )
    }
)

$Classified = @()

foreach ($Message in @($BodyData.messages)) {

    $text = (
        ([string]$Message.Subject) + "`n" +
        ([string]$Message.PreferredBody)
    ).ToLowerInvariant()

    $BestType = "UNKNOWN"
    $BestScore = 0
    $BrokerOnly = $true
    $MatchedTerms = @()

    foreach ($Rule in $Rules) {

        $score = 0
        $terms = @()

        foreach ($Term in $Rule.Terms) {

            if ($text.Contains($Term.ToLowerInvariant())) {
                $score += 20
                $terms += $Term
            }
        }

        if ($score -gt $BestScore) {
            $BestScore = $score
            $BestType = $Rule.Type
            $BrokerOnly = [bool]$Rule.BrokerOnly
            $MatchedTerms = $terms
        }
    }

    $confidence = [Math]::Min(100, $BestScore)

    $Classified += [pscustomobject]@{
        MessageId = [string]$Message.MessageId
        ThreadId = [string]$Message.ThreadId
        Subject = [string]$Message.Subject
        From = [string]$Message.From
        LeadType = $BestType
        Confidence = $confidence
        BrokerOnly = $BrokerOnly
        RequiresBrokerReview = (
            $BestType -eq "UNKNOWN" -or
            $confidence -lt 60
        )
        MatchedTerms = $MatchedTerms
    }
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $PSScriptRoot "reports\ClassifiedMessages.json"
}

[ordered]@{
    subsystem = "LEAD_MIGRATION"
    release = "MOS5-016-S1H"
    classifiedCount = $Classified.Count
    messages = $Classified
    previewOnly = $true
    generatedAt = (Get-Date).ToString("o")
} |
ConvertTo-Json -Depth 20 |
Set-Content -LiteralPath $OutputPath -Encoding UTF8

Write-Host "[PASS] Messages classified: $($Classified.Count)"
