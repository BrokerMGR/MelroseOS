<#
MelroseOS Enterprise
Update Manager Module : UPD-007_UpdatePlanner
Release: MOS5-019
#>

$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\UpdateManager\Core\UPD-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){
    Write-Host '[FAIL] UPD-000_Common.ps1 not found.' -ForegroundColor Red
    exit 1
}
. $Common

Write-UPDHeader 'UPD-007 Update Planner'

$DiscoveryPath=Join-Path $Global:UPD_REPORTS 'UPD-004-Discovery.json'
$DependencyPath=Join-Path $Global:UPD_REPORTS 'UPD-006-DependencyCheck.json'

if(!(Test-Path -LiteralPath $DiscoveryPath)){
    Write-UPDFail "Update discovery report not found: $DiscoveryPath"
    exit 1
}

if(!(Test-Path -LiteralPath $DependencyPath)){
    Write-UPDFail "Dependency check report not found: $DependencyPath"
    exit 1
}

$Discovery=Get-Content -LiteralPath $DiscoveryPath -Raw|ConvertFrom-Json
$Dependency=Get-Content -LiteralPath $DependencyPath -Raw|ConvertFrom-Json

if(-not [bool]$Dependency.passed){
    Write-UPDFail 'Dependency check did not pass. Update planning blocked.'
    exit 1
}

$Config=Get-UPDConfig
$Channel=[string]$Config['CHANNEL']
$Plans=@()
$Failed=0

foreach($Update in @($Discovery.updates)){
    $Id=[string]$Update.packageId
    $From=[string]$Update.fromVersion
    $To=[string]$Update.toVersion
    $Passed=(
        -not [string]::IsNullOrWhiteSpace($Id) -and
        -not [string]::IsNullOrWhiteSpace($From) -and
        -not [string]::IsNullOrWhiteSpace($To)
    )

    if(-not $Passed){$Failed++}

    $Plans += [pscustomobject]@{
        packageId=$Id
        fromVersion=$From
        toVersion=$To
        channel=$Channel
        action=if($Passed){'PLAN_UPDATE'}else{'INVALID_UPDATE'}
        requiresSnapshot=$true
        requiresCertification=$true
        requiresRollbackPoint=$true
        passed=$Passed
    }

    if($Passed){
        Write-UPDPass "$Id update planned: $From -> $To"
    }else{
        Write-UPDFail "$Id update plan invalid"
    }
}

$Report=[ordered]@{
    release='MOS5-019'
    module='UPD-007'
    generatedAt=(Get-Date).ToString('o')
    previewOnly=$true
    executionEnabled=$false
    failedCount=$Failed
    passed=($Failed-eq0)
    plans=$Plans
}

$Path=Write-UPDJson -Data $Report -FileName 'UPD-007-UpdatePlan.json'

if($Failed-gt0){
    Write-UPDFail "Update planning failed. Report: $Path"
    exit 1
}

Write-UPDPass "Update planning passed. Report: $Path"
exit 0
