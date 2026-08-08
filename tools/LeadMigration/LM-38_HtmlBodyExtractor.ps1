param(
    [Parameter(Mandatory=$true)]
    [string]$InputPath,

    [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"

function Convert-HtmlToPlainText {
    param([string]$Html)

    if ([string]::IsNullOrWhiteSpace($Html)) {
        return ""
    }

    $text = $Html

    $text = [regex]::Replace(
        $text,
        '(?is)<(script|style).*?>.*?</\1>',
        ' '
    )

    $text = [regex]::Replace(
        $text,
        '(?i)<br\s*/?>',
        "`n"
    )

    $text = [regex]::Replace(
        $text,
        '(?i)</p\s*>',
        "`n"
    )

    $text = [regex]::Replace(
        $text,
        '(?is)<[^>]+>',
        ' '
    )

    $text = [System.Net.WebUtility]::HtmlDecode($text)

    $text = $text -replace "`r", ""
    $text = [regex]::Replace($text, '[ \t]+', ' ')
    $text = [regex]::Replace($text, '\n{3,}', "`n`n")

    return $text.Trim()
}

if (!(Test-Path -LiteralPath $InputPath)) {
    throw "Input file not found: $InputPath"
}

$Decoded =
    Get-Content -LiteralPath $InputPath -Raw |
    ConvertFrom-Json

$Rows = @()

foreach ($Message in @($Decoded.messages)) {

    $plainParts = @(
        $Message.Parts |
        Where-Object {
            ([string]$_.MimeType).ToLowerInvariant() -eq "text/plain" -and
            ![string]::IsNullOrWhiteSpace([string]$_.Text)
        }
    )

    $htmlParts = @(
        $Message.Parts |
        Where-Object {
            ([string]$_.MimeType).ToLowerInvariant() -eq "text/html" -and
            ![string]::IsNullOrWhiteSpace([string]$_.Text)
        }
    )

    $plainText = (
        $plainParts |
        ForEach-Object {
            [string]$_.Text
        }
    ) -join "`n`n"

    $htmlText = (
        $htmlParts |
        ForEach-Object {
            Convert-HtmlToPlainText ([string]$_.Text)
        }
    ) -join "`n`n"

    $preferred =
        if (![string]::IsNullOrWhiteSpace($plainText)) {
            $plainText.Trim()
        }
        else {
            $htmlText.Trim()
        }

    $Rows += [pscustomobject]@{
        MessageId = [string]$Message.MessageId
        ThreadId = [string]$Message.ThreadId
        Subject = [string]$Message.Subject
        From = [string]$Message.From
        PlainText = $plainText.Trim()
        HtmlText = $htmlText.Trim()
        PreferredBody = $preferred
    }
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $PSScriptRoot "reports\ExtractedMessageBodies.json"
}

[ordered]@{
    subsystem = "LEAD_MIGRATION"
    release = "MOS5-016-S1H"
    messages = $Rows
    generatedAt = (Get-Date).ToString("o")
} |
ConvertTo-Json -Depth 30 |
Set-Content -LiteralPath $OutputPath -Encoding UTF8

Write-Host "[PASS] Bodies extracted: $($Rows.Count)"
