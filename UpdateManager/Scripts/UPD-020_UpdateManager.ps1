<#
MelroseOS Enterprise
Update Manager Module : UPD-020_UpdateManager
Release: MOS5-019
Version: 1.0.0
#>

$ErrorActionPreference = 'Stop'

$Common = 'D:\MelroseOS\GitHub\MelroseOS\UpdateManager\Core\UPD-000_Common.ps1'
if (!(Test-Path -LiteralPath $Common)) {
    Write-Host '[FAIL] UPD-000_Common.ps1 not found.' -ForegroundColor Red
    exit 1
}
. $Common

Write-UPDHeader 'UPD-020 Update Manager'

$Config = Get-UPDConfig
$Registry = Get-UPDRegistry

$RequiredModules = @()
for ($i = 1; $i -le 19; $i++) {
    $RequiredModules += ('UPD-{0:D3}_' -f $i)
}

$ScriptRoot = Join-Path $Global:UPD_MANAGER 'Scripts'
$ModuleChecks = @()
$Failed = 0

foreach ($Prefix in $RequiredModules) {
    $File = Get-ChildItem -LiteralPath $ScriptRoot -Filter "$Prefix*.ps1" -File -ErrorAction SilentlyContinue |
        Select-Object -First 1

    $Passed = $false
    $Details = 'Missing'

    if ($File) {
        $Tokens = $null
        $Errors = $null

        [System.Management.Automation.Language.Parser]::ParseFile(
            $File.FullName,
            [ref]$Tokens,
            [ref]$Errors
        ) | Out-Null

        $Passed = ($File.Length -gt 500 -and $Errors.Count -eq 0)
        $Details = "$($File.Length) bytes; syntax errors=$($Errors.Count)"
    }

    if (-not $Passed) {
        $Failed++
    }

    $ModuleChecks += [pscustomobject]@{
        module = $Prefix.TrimEnd('_')
        path = if ($File) { $File.FullName } else { '' }
        details = $Details
        passed = $Passed
    }

    if ($Passed) {
        Write-UPDPass "$($File.Name) - $Details"
    }
    else {
        Write-UPDFail "$Prefix - $Details"
    }
}

$RequiredReports = @(
    'UPD-001-Registry.json',
    'UPD-002-Channels.json',
    'UPD-003-VersionScan.json',
    'UPD-004-Discovery.json',
    'UPD-005-ManifestValidation.json',
    'UPD-006-DependencyCheck.json',
    'UPD-007-UpdatePlan.json',
    'UPD-008-DownloadManager.json',
    'UPD-009-Staging.json',
    'UPD-010-PreUpdateSnapshot.json',
    'UPD-011-UpdateInstaller.json',
    'UPD-012-PostUpdateValidation.json',
    'UPD-013-Rollback.json',
    'UPD-014-ReleaseNotes.json',
    'UPD-015-UpdateReport.json',
    'UPD-016-Diagnostics.json',
    'UPD-017-CertificationGate.json',
    'UPD-018-UpdateHistory.json',
    'UPD-019-CacheCleanup.json'
)

$ReportChecks = @()

foreach ($Name in $RequiredReports) {
    $Path = Join-Path $Global:UPD_REPORTS $Name
    $Exists = Test-Path -LiteralPath $Path
    $Valid = $false
    $Passed = $false
    $Details = 'Missing'

    if ($Exists) {
        try {
            $Raw = Get-Content -LiteralPath $Path -Raw
            if ([string]::IsNullOrWhiteSpace($Raw)) {
                throw 'Empty report'
            }

            $Data = $Raw | ConvertFrom-Json
            $Valid = $true
            $Passed = ($null -eq $Data.passed -or [bool]$Data.passed)
            $Details = if ($Passed) { 'PASS' } else { 'Source report failed' }
        }
        catch {
            $Details = $_.Exception.Message
        }
    }

    if (-not $Passed) {
        $Failed++
    }

    $ReportChecks += [pscustomobject]@{
        report = $Name
        path = $Path
        exists = $Exists
        validJson = $Valid
        passed = $Passed
        details = $Details
    }

    if ($Passed) {
        Write-UPDPass $Name
    }
    else {
        Write-UPDWarn "$Name : $Details"
    }
}

$Summary = [ordered]@{
    release = 'MOS5-019'
    module = 'UPD-020'
    version = '1.0.0'
    generatedAt = (Get-Date).ToString('o')
    channel = [string]$Config['CHANNEL']
    mode = [string]$Config['MODE']
    autoCheck = [string]$Config['AUTO_CHECK']
    autoDownload = [string]$Config['AUTO_DOWNLOAD']
    autoInstall = [string]$Config['AUTO_INSTALL']
    requireCertification = [string]$Config['REQUIRE_CERTIFICATION']
    requireSnapshot = [string]$Config['REQUIRE_SNAPSHOT']
    rollbackAllowed = [string]$Config['ALLOW_ROLLBACK']
    updateRegistryCount = @($Registry.updates).Count
    moduleCheckCount = $ModuleChecks.Count
    reportCheckCount = $ReportChecks.Count
    failedCheckCount = $Failed
    overallStatus = if ($Failed -eq 0) { 'READY' } else { 'NOT_READY' }
    passed = ($Failed -eq 0)
    moduleChecks = $ModuleChecks
    reportChecks = $ReportChecks
}

$SummaryPath = Write-UPDJson -Data $Summary -FileName 'UPD-020-UpdateManager.json'

Write-Host ''
Write-Host '=========================================================='
Write-Host ' MOS5-019 UPDATE MANAGER FINAL STATUS'
Write-Host '=========================================================='
Write-Host ''
Write-Host "Status       : $($Summary.overallStatus)"
Write-Host "Failed Checks: $Failed"
Write-Host "Report       : $SummaryPath"
Write-Host ''

if ($Failed -gt 0) {
    exit 1
}

Write-UPDPass 'MOS5-019 Update Manager ready.'
exit 0
