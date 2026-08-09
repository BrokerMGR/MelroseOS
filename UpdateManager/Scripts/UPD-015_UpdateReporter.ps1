<#
MelroseOS Enterprise
Update Manager Module : UPD-015_UpdateReporter
Release: MOS5-019
#>

$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\UpdateManager\Core\UPD-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){
    Write-Host '[FAIL] UPD-000_Common.ps1 not found.' -ForegroundColor Red
    exit 1
}
. $Common

Write-UPDHeader 'UPD-015 Update Reporter'

$Registry=Get-UPDRegistry
$ReportsToCheck=@(
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
    'UPD-014-ReleaseNotes.json'
)

$Rows=@()
$Failed=0

foreach($Name in $ReportsToCheck){
    $Path=Join-Path $Global:UPD_REPORTS $Name
    $Exists=Test-Path -LiteralPath $Path
    $Valid=$false
    $Passed=$false
    $Details='Missing'

    if($Exists){
        try{
            $Raw=Get-Content -LiteralPath $Path -Raw
            if([string]::IsNullOrWhiteSpace($Raw)){throw 'Empty report'}
            $Data=$Raw|ConvertFrom-Json
            $Valid=$true
            $Passed=($null-eq$Data.passed -or [bool]$Data.passed)
            $Details=if($Passed){'PASS'}else{'Source report reports failure'}
        }catch{
            $Details=$_.Exception.Message
        }
    }

    if(-not $Passed){$Failed++}

    $Rows += [pscustomobject]@{
        report=$Name
        path=$Path
        exists=$Exists
        validJson=$Valid
        passed=$Passed
        details=$Details
    }

    if($Passed){
        Write-UPDPass $Name
    }else{
        Write-UPDWarn "$Name : $Details"
    }
}

$Summary=[ordered]@{
    release='MOS5-019'
    module='UPD-015'
    generatedAt=(Get-Date).ToString('o')
    updateRegistryCount=@($Registry.updates).Count
    reportCount=$Rows.Count
    failedReportCount=$Failed
    passed=($Failed-eq0)
    reports=$Rows
}

$JsonPath=Write-UPDJson -Data $Summary -FileName 'UPD-015-UpdateReport.json'

$MarkdownPath=Join-Path $Global:UPD_REPORTS 'UpdateSummary.md'
$Lines=@(
    '# MelroseOS Update Manager Summary',
    '',
    'Release: MOS5-019',
    '',
    "Update registry entries: $(@($Registry.updates).Count)",
    "Reports checked: $($Rows.Count)",
    "Failed reports: $Failed",
    '',
    '| Report | Status |',
    '|---|---|'
)

foreach($Row in $Rows){
    $Status=if($Row.passed){'PASS'}else{'FAIL'}
    $Lines += "| $($Row.report) | $Status |"
}

$Lines|Set-Content -LiteralPath $MarkdownPath -Encoding UTF8

if($Failed-gt0){
    Write-UPDFail "Update reporting found $Failed failed report(s). Report: $JsonPath"
    exit 1
}

Write-UPDPass "Update reporting passed. Report: $JsonPath"
Write-UPDPass "Summary: $MarkdownPath"
exit 0
