param(
    [Parameter(Mandatory=$true)]
    [string]$InputPath,

    [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"

if (!(Test-Path -LiteralPath $InputPath)) {
    throw "Input file not found: $InputPath"
}

$Raw = Get-Content -LiteralPath $InputPath -Raw

try {
    $Message = $Raw | ConvertFrom-Json
}
catch {
    throw "Input must be JSON representing a message object."
}

function Get-FirstEmail {
    param([string]$Text)
    $m = [regex]::Match([string]$Text, '[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}', 'IgnoreCase')
    if ($m.Success) { return $m.Value.ToLowerInvariant() }
    return ""
}

function Get-FirstPhone {
    param([string]$Text)
    $m = [regex]::Match([string]$Text, '(?:\+?1[\s\.\-]?)?(?:\(?\d{3}\)?[\s\.\-]?)\d{3}[\s\.\-]?\d{4}')
    if ($m.Success) { return $m.Value }
    return ""
}

function Normalize-Phone {
    param([string]$Phone)
    $digits = ($Phone -replace '\D','')
    if ($digits.Length -eq 11 -and $digits.StartsWith("1")) {
        $digits = $digits.Substring(1)
    }
    if ($digits.Length -eq 10) {
        return $digits
    }
    return $digits
}

function Get-DisplayNameFromFromHeader {
    param([string]$From)
    if ([string]::IsNullOrWhiteSpace($From)) { return "" }
    $value = $From.Trim()
    if ($value -match '^\s*"?([^"<]+?)"?\s*<') {
        return $Matches[1].Trim()
    }
    return ""
}

$From = [string]$Message.from
$Subject = [string]$Message.subject
$Body = [string]$Message.body
$Combined = "$From`n$Subject`n$Body"

$Email = Get-FirstEmail $Combined
$PhoneRaw = Get-FirstPhone $Combined
$Phone = Normalize-Phone $PhoneRaw
$DisplayName = Get-DisplayNameFromFromHeader $From

$FirstName = ""
$LastName = ""

if ($DisplayName) {
    $parts = @($DisplayName -split '\s+' | Where-Object { $_ })
    if ($parts.Count -ge 1) { $FirstName = $parts[0] }
    if ($parts.Count -ge 2) { $LastName = $parts[$parts.Count - 1] }
}

$AddressPattern = '\b\d{1,6}\s+[A-Za-z0-9\.\-'' ]+\s(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Circle|Cir|Place|Pl|Parkway|Pkwy|Highway|Hwy)\b'
$AddressMatch = [regex]::Match($Combined, $AddressPattern, 'IgnoreCase')
$Address = if ($AddressMatch.Success) { $AddressMatch.Value.Trim() } else { "" }

$Parsed = [ordered]@{
    messageId = [string]$Message.messageId
    threadId = [string]$Message.threadId
    from = $From
    subject = $Subject
    receivedAt = [string]$Message.receivedAt
    firstName = $FirstName
    lastName = $LastName
    email = $Email
    phone = $Phone
    address = $Address
    body = $Body
    parsedAt = (Get-Date).ToString("o")
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $PSScriptRoot "reports\ParsedLeadMessage.json"
}

$Parent = Split-Path $OutputPath -Parent
if ($Parent -and !(Test-Path $Parent)) {
    New-Item -ItemType Directory -Path $Parent -Force | Out-Null
}

$Parsed |
ConvertTo-Json -Depth 10 |
Set-Content -LiteralPath $OutputPath -Encoding UTF8

$Parsed
