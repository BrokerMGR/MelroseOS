param(
    [Parameter(Mandatory=$true)]
    [string]$InputPath,

    [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"

if (!(Test-Path -LiteralPath $InputPath)) {
    throw "Input file not found: $InputPath"
}

$Decoded =
    Get-Content -LiteralPath $InputPath -Raw |
    ConvertFrom-Json

$Attachments = @()

foreach ($Message in @($Decoded.messages)) {

    foreach ($Part in @($Message.Parts)) {

        $filename = [string]$Part.Filename
        $attachmentId = [string]$Part.AttachmentId

        if (
            ![string]::IsNullOrWhiteSpace($filename) -or
            ![string]::IsNullOrWhiteSpace($attachmentId)
        ) {

            $Attachments += [pscustomobject]@{
                MessageId = [string]$Message.MessageId
                ThreadId = [string]$Message.ThreadId
                PartPath = [string]$Part.PartPath
                Filename = $filename
                MimeType = [string]$Part.MimeType
                AttachmentId = $attachmentId
                Size = [int64]$Part.Size
                Downloaded = $false
            }
        }
    }
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $PSScriptRoot "reports\AttachmentCatalog.json"
}

[ordered]@{
    subsystem = "LEAD_MIGRATION"
    release = "MOS5-016-S1H"
    attachmentCount = $Attachments.Count
    attachments = $Attachments
    contentDownloaded = $false
    generatedAt = (Get-Date).ToString("o")
} |
ConvertTo-Json -Depth 20 |
Set-Content -LiteralPath $OutputPath -Encoding UTF8

Write-Host "[PASS] Attachments cataloged: $($Attachments.Count)"
