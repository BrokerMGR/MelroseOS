<#
MelroseOS Enterprise
Update Manager Module : UPD-012_PostUpdateValidator
Release: MOS5-019
#>

$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\UpdateManager\Core\UPD-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){
    Write-Host '[FAIL] UPD-000_Common.ps1 not found.' -ForegroundColor Red
    exit 1
}
. $Common

Write-UPDHeader 'UPD-012 Post-Update Validator'

$InstallerReport=Join-Path $Global:UPD_REPORTS 'UPD-011-UpdateInstaller.json'
$SnapshotReport=Join-Path $Global:UPD_REPORTS 'UPD-010-PreUpdateSnapshot.json'
$StagingReport=Join-Path $Global:UPD_REPORTS 'UPD-009-Staging.json'

$Required=@($InstallerReport,$SnapshotReport,$StagingReport)
$Results=@()
$Failed=0

foreach($Path in $Required){
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
            $Details=if($Passed){'Valid'}else{'Source report failed'}
        }catch{
            $Details=$_.Exception.Message
        }
    }

    if(-not $Passed){$Failed++}

    $Results += [pscustomobject]@{
        path=$Path
        exists=$Exists
        validJson=$Valid
        passed=$Passed
        details=$Details
    }

    if($Passed){Write-UPDPass $Path}else{Write-UPDFail "$Path : $Details"}
}

$Registry=Get-UPDRegistry
$RegistryValid=($null-ne$Registry -and $null-ne$Registry.updates)

if(-not $RegistryValid){$Failed++}

$Results += [pscustomobject]@{
    path=$Global:UPD_REGISTRY
    exists=(Test-Path -LiteralPath $Global:UPD_REGISTRY)
    validJson=$RegistryValid
    passed=$RegistryValid
    details=if($RegistryValid){'Update registry readable'}else{'Update registry invalid'}
}

if($RegistryValid){Write-UPDPass 'Update registry readable'}else{Write-UPDFail 'Update registry invalid'}

$Report=[ordered]@{
    release='MOS5-019'
    module='UPD-012'
    generatedAt=(Get-Date).ToString('o')
    failedCount=$Failed
    passed=($Failed-eq0)
    checks=$Results
}

$Path=Write-UPDJson -Data $Report -FileName 'UPD-012-PostUpdateValidation.json'
if($Failed-gt0){
    Write-UPDFail "Post-update validation failed. Report: $Path"
    exit 1
}

Write-UPDPass "Post-update validation passed. Report: $Path"
exit 0
