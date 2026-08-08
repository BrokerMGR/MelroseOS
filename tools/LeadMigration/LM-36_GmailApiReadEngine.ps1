param(
    [Parameter(Mandatory=$false)]
    [string]$InputPath = "",

    [Parameter(Mandatory=$false)]
    [string]$OutputPath = "",

    [int]$MaxMessages = 100
)

$ErrorActionPreference = "Stop"

function ConvertFrom-Base64Url {
    param([string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return [byte[]]@()
    }

    $s = $Value.Replace("-", "+").Replace("_", "/")

    switch ($s.Length % 4) {
        2 { $s += "==" }
        3 { $s += "=" }
    }

    return [Convert]::FromBase64String($s)
}

function Get-GmailHeaderValue {
    param(
        $Headers,
        [string]$Name
    )

    if (!$Headers) {
        return ""
    }

    $match = @(
        $Headers |
        Where-Object {
            ([string]$_.name).Equals(
                $Name,
                [System.StringComparison]::OrdinalIgnoreCase
            )
        }
    ) | Select-Object -First 1

    if ($match) {
        return [string]$match.value
    }

    return ""
}

function Convert-GmailApiMessage {
    param($Message)

    $payload = $Message.payload
    $headers = if ($payload) { $payload.headers } else { @() }

    $internalDate = $null

    if ($Message.internalDate) {
        try {
            $epoch = [DateTimeOffset]::FromUnixTimeMilliseconds(
                [int64]$Message.internalDate
            )
            $internalDate = $epoch.ToString("o")
        }
        catch {
            $internalDate = $null
        }
    }

    return [ordered]@{
        messageId = [string]$Message.id
        threadId = [string]$Message.threadId
        historyId = [string]$Message.historyId
        labelIds = @($Message.labelIds)
        snippet = [string]$Message.snippet
        internalDate = $internalDate
        from = Get-GmailHeaderValue $headers "From"
        to = Get-GmailHeaderValue $headers "To"
        cc = Get-GmailHeaderValue $headers "Cc"
        subject = Get-GmailHeaderValue $headers "Subject"
        dateHeader = Get-GmailHeaderValue $headers "Date"
        mimeType = if ($payload) { [string]$payload.mimeType } else { "" }
        payload = $payload
    }
}

$Reports = Join-Path $PSScriptRoot "reports"

if (!(Test-Path -LiteralPath $Reports)) {
    New-Item -ItemType Directory -Path $Reports -Force | Out-Null
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $Reports "GmailApiReadPreview.json"
}

$Messages = @()

if (![string]::IsNullOrWhiteSpace($InputPath)) {

    if (!(Test-Path -LiteralPath $InputPath)) {
        throw "Input file not found: $InputPath"
    }

    $Raw = Get-Content -LiteralPath $InputPath -Raw | ConvertFrom-Json

    if ($Raw.messages) {
        $SourceMessages = @($Raw.messages)
    }
    elseif ($Raw.id) {
        $SourceMessages = @($Raw)
    }
    else {
        $SourceMessages = @()
    }

    foreach ($Message in ($SourceMessages | Select-Object -First $MaxMessages)) {
        $Messages += Convert-GmailApiMessage $Message
    }
}

$Result = [ordered]@{
    subsystem = "LEAD_MIGRATION"
    release = "MOS5-016-S1H"
    module = "LM-36_GmailApiReadEngine"
    mode = "READ_ONLY_PREVIEW"
    directNetworkReadEnabled = $false
    inputPath = $InputPath
    messagesRead = $Messages.Count
    maxMessages = $MaxMessages
    messages = $Messages
    generatedAt = (Get-Date).ToString("o")
}

$Result |
ConvertTo-Json -Depth 100 |
Set-Content -LiteralPath $OutputPath -Encoding UTF8

$Result
