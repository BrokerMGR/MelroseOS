param(
    [Parameter(Mandatory=$true)]
    [string]$InputPath,

    [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"

function ConvertFrom-Base64UrlText {
    param([string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return ""
    }

    $s = $Value.Replace("-", "+").Replace("_", "/")

    switch ($s.Length % 4) {
        2 { $s += "==" }
        3 { $s += "=" }
    }

    try {
        $bytes = [Convert]::FromBase64String($s)
        return [System.Text.Encoding]::UTF8.GetString($bytes)
    }
    catch {
        return ""
    }
}

function Expand-GmailPart {
    param(
        $Part,
        [string]$ParentPath = "0"
    )

    $Rows = @()

    if (!$Part) {
        return $Rows
    }

    $bodyData = ""

    if ($Part.body -and $Part.body.data) {
        $bodyData = ConvertFrom-Base64UrlText ([string]$Part.body.data)
    }

    $Rows += [pscustomobject]@{
        PartPath = $ParentPath
        MimeType = [string]$Part.mimeType
        Filename = [string]$Part.filename
        AttachmentId = if ($Part.body) { [string]$Part.body.attachmentId } else { "" }
        Size = if ($Part.body) { [int64]($Part.body.size) } else { 0 }
        Text = $bodyData
        Headers = @($Part.headers)
    }

    $children = @($Part.parts)

    for ($i = 0; $i -lt $children.Count; $i++) {
        $Rows += Expand-GmailPart `
            -Part $children[$i] `
            -ParentPath "$ParentPath.$i"
    }

    return $Rows
}

if (!(Test-Path -LiteralPath $InputPath)) {
    throw "Input file not found: $InputPath"
}

$InputObject =
    Get-Content -LiteralPath $InputPath -Raw |
    ConvertFrom-Json

$Messages =
    if ($InputObject.messages) {
        @($InputObject.messages)
    }
    else {
        @($InputObject)
    }

$Decoded = @()

foreach ($Message in $Messages) {

    $Parts = Expand-GmailPart -Part $Message.payload

    $Decoded += [pscustomobject]@{
        MessageId = [string]$Message.messageId
        ThreadId = [string]$Message.threadId
        Subject = [string]$Message.subject
        From = [string]$Message.from
        Parts = $Parts
    }
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $PSScriptRoot "reports\DecodedMimeMessages.json"
}

[ordered]@{
    subsystem = "LEAD_MIGRATION"
    release = "MOS5-016-S1H"
    messages = $Decoded
    generatedAt = (Get-Date).ToString("o")
} |
ConvertTo-Json -Depth 100 |
Set-Content -LiteralPath $OutputPath -Encoding UTF8

Write-Host "[PASS] MIME messages decoded: $($Decoded.Count)"
