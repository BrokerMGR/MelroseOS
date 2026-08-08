param(
    [Parameter(Mandatory=$true)]
    [string]$InputDirectory,

    [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"

if (!(Test-Path -LiteralPath $InputDirectory)) {
    throw "Input directory not found: $InputDirectory"
}

$Files = @(
    Get-ChildItem -LiteralPath $InputDirectory -File -Filter *.json -ErrorAction SilentlyContinue
)

$Rows = @()

foreach ($File in $Files) {
    try {
        $Lead = Get-Content -LiteralPath $File.FullName -Raw | ConvertFrom-Json

        if (
            $Lead.email -or
            $Lead.phone -or
            $Lead.firstName -or
            $Lead.lastName
        ) {
            $Rows += [pscustomobject]@{
                File = $File.Name
                FirstName = [string]$Lead.firstName
                LastName = [string]$Lead.lastName
                Email = [string]$Lead.email
                Phone = [string]$Lead.phone
                Address = [string]$Lead.address
                Source = [string]$Lead.source
                LeadType = [string]$Lead.leadType
                Fingerprint = [string]$Lead.identityFingerprint
            }
        }
    }
    catch {
        # malformed candidate files are omitted from preview but not fatal
    }
}

$UniqueFingerprints = @(
    $Rows |
    Where-Object { $_.Fingerprint } |
    Select-Object -ExpandProperty Fingerprint -Unique
)

$Preview = [ordered]@{
    subsystem = "LEAD_MIGRATION"
    release = "MOS5-016-S1G"
    generatedAt = (Get-Date).ToString("o")
    previewOnly = $true
    commitEnabled = $false
    outboundBlocked = $true
    inputFiles = $Files.Count
    candidateLeads = $Rows.Count
    uniqueFingerprints = $UniqueFingerprints.Count
    rows = $Rows
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $PSScriptRoot "reports\ExtractionPreview.json"
}

$Preview |
ConvertTo-Json -Depth 20 |
Set-Content -LiteralPath $OutputPath -Encoding UTF8

$Preview
