param(
    [string]$Mailbox = "",
    [datetime]$StartDate,
    [datetime]$EndDate,
    [string[]]$IncludeTerms = @(),
    [string[]]$ExcludeTerms = @(),
    [switch]$IncludeSpam,
    [switch]$IncludeTrash
)

$ErrorActionPreference = "Stop"

function ConvertTo-GmailDate {
    param([datetime]$Date)
    return $Date.ToString("yyyy/MM/dd")
}

$Parts = @()

if ($PSBoundParameters.ContainsKey("StartDate")) {
    $Parts += "after:$(ConvertTo-GmailDate $StartDate)"
}

if ($PSBoundParameters.ContainsKey("EndDate")) {
    $Parts += "before:$(ConvertTo-GmailDate $EndDate.AddDays(1))"
}

if (!$IncludeSpam) {
    $Parts += "-in:spam"
}

if (!$IncludeTrash) {
    $Parts += "-in:trash"
}

foreach ($Term in $IncludeTerms) {
    if (![string]::IsNullOrWhiteSpace($Term)) {
        $escaped = $Term.Replace('"','\"')
        $Parts += '"' + $escaped + '"'
    }
}

foreach ($Term in $ExcludeTerms) {
    if (![string]::IsNullOrWhiteSpace($Term)) {
        $escaped = $Term.Replace('"','\"')
        $Parts += '-"' + $escaped + '"'
    }
}

$Query = ($Parts -join " ").Trim()

$Result = [ordered]@{
    subsystem = "LEAD_MIGRATION"
    release = "MOS5-016-S1G"
    module = "LM-31_GmailQueryBuilder"
    mailbox = $Mailbox
    query = $Query
    previewOnly = $true
    generatedAt = (Get-Date).ToString("o")
}

$Reports = Join-Path $PSScriptRoot "reports"
if (!(Test-Path $Reports)) {
    New-Item -ItemType Directory -Path $Reports -Force | Out-Null
}

$Result |
ConvertTo-Json -Depth 10 |
Set-Content -LiteralPath (Join-Path $Reports "GmailQueryBuilder.json") -Encoding UTF8

$Result
