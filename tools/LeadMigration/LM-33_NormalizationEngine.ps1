param(
    [Parameter(Mandatory=$true)]
    [string]$InputPath,

    [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"

if (!(Test-Path -LiteralPath $InputPath)) {
    throw "Input file not found: $InputPath"
}

$Lead = Get-Content -LiteralPath $InputPath -Raw | ConvertFrom-Json

function Normalize-NamePart {
    param([string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) { return "" }
    $text = $Value.Trim().ToLowerInvariant()
    if ($text.Length -eq 1) { return $text.ToUpperInvariant() }
    return $text.Substring(0,1).ToUpperInvariant() + $text.Substring(1)
}

function Normalize-Email {
    param([string]$Value)
    return ([string]$Value).Trim().ToLowerInvariant()
}

function Normalize-Phone {
    param([string]$Value)
    $digits = (([string]$Value) -replace '\D','')
    if ($digits.Length -eq 11 -and $digits.StartsWith("1")) {
        $digits = $digits.Substring(1)
    }
    return $digits
}

$Canonical = [ordered]@{
    firstName = Normalize-NamePart ([string]$Lead.firstName)
    lastName = Normalize-NamePart ([string]$Lead.lastName)
    email = Normalize-Email ([string]$Lead.email)
    phone = Normalize-Phone ([string]$Lead.phone)
    address = ([string]$Lead.address).Trim()
    source = if ($Lead.source) { ([string]$Lead.source).Trim().ToUpperInvariant() } else { "UNKNOWN" }
    leadType = if ($Lead.leadType) { ([string]$Lead.leadType).Trim().ToUpperInvariant() } else { "UNKNOWN" }
    messageId = [string]$Lead.messageId
    threadId = [string]$Lead.threadId
    receivedAt = [string]$Lead.receivedAt
    normalizedAt = (Get-Date).ToString("o")
}

$IdentityString = (
    $Canonical.email + "|" +
    $Canonical.phone + "|" +
    $Canonical.firstName + "|" +
    $Canonical.lastName + "|" +
    $Canonical.address
).ToLowerInvariant()

$sha = [System.Security.Cryptography.SHA256]::Create()
try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($IdentityString)
    $hashBytes = $sha.ComputeHash($bytes)
    $Canonical.identityFingerprint = ([System.BitConverter]::ToString($hashBytes)).Replace("-","").ToLowerInvariant()
}
finally {
    $sha.Dispose()
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $PSScriptRoot "reports\NormalizedLead.json"
}

$Canonical |
ConvertTo-Json -Depth 10 |
Set-Content -LiteralPath $OutputPath -Encoding UTF8

$Canonical
