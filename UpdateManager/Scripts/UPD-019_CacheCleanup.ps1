<#
MelroseOS Enterprise
Update Manager Module : UPD-019_CacheCleanup
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

Write-UPDHeader 'UPD-019 Cache Cleanup'

$Config = Get-UPDConfig
$CleanupEnabled = ([string]$Config['DESTRUCTIVE_ACTIONS'] -eq 'TRUE')

$Targets = @(
    (Join-Path $Global:UPD_MANAGER 'Temp'),
    (Join-Path $Global:UPD_MANAGER 'Packages\Downloaded'),
    (Join-Path $Global:UPD_MANAGER 'Staging')
)

$Results = @()
$Failed = 0

foreach ($Target in $Targets) {
    if (!(Test-Path -LiteralPath $Target)) {
        New-Item -ItemType Directory -Force -Path $Target | Out-Null
    }

    $Items = @(Get-ChildItem -LiteralPath $Target -Force -ErrorAction SilentlyContinue)
    $Removed = 0
    $Status = 'PREVIEW_ONLY'
    $Passed = $true
    $ErrorText = ''

    if ($CleanupEnabled) {
        try {
            foreach ($Item in $Items) {
                Remove-Item -LiteralPath $Item.FullName -Recurse -Force
                $Removed++
            }
            $Status = 'CLEANED'
        }
        catch {
            $Passed = $false
            $Failed++
            $Status = 'FAILED'
            $ErrorText = $_.Exception.Message
        }
    }

    $Results += [pscustomobject]@{
        path = $Target
        itemsFound = $Items.Count
        removedCount = $Removed
        destructiveActionsEnabled = $CleanupEnabled
        status = $Status
        passed = $Passed
        error = $ErrorText
    }

    if ($Passed) {
        Write-UPDPass "$Target : $Status"
    }
    else {
        Write-UPDFail "$Target : $ErrorText"
    }
}

$Report = [ordered]@{
    release = 'MOS5-019'
    module = 'UPD-019'
    version = '1.0.0'
    generatedAt = (Get-Date).ToString('o')
    destructiveActionsEnabled = $CleanupEnabled
    previewOnly = (-not $CleanupEnabled)
    failedCount = $Failed
    passed = ($Failed -eq 0)
    results = $Results
}

$ReportPath = Write-UPDJson -Data $Report -FileName 'UPD-019-CacheCleanup.json'

if ($Failed -gt 0) {
    Write-UPDFail "Cache cleanup failed. Report: $ReportPath"
    exit 1
}

Write-UPDPass "Cache cleanup completed. Report: $ReportPath"
exit 0
