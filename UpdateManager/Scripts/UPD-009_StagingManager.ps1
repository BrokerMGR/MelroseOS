<#
MelroseOS Enterprise
Update Manager Module : UPD-009_StagingManager
Release: MOS5-019
#>

$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\UpdateManager\Core\UPD-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){
    Write-Host '[FAIL] UPD-000_Common.ps1 not found.' -ForegroundColor Red
    exit 1
}
. $Common

Write-UPDHeader 'UPD-009 Staging Manager'

$PlanPath=Join-Path $Global:UPD_REPORTS 'UPD-007-UpdatePlan.json'
if(!(Test-Path -LiteralPath $PlanPath)){
    Write-UPDFail "Update plan not found: $PlanPath"
    exit 1
}

$Plan=Get-Content -LiteralPath $PlanPath -Raw|ConvertFrom-Json
$StageRoot=Join-Path $Global:UPD_MANAGER 'Staging'

if(!(Test-Path -LiteralPath $StageRoot)){
    New-Item -ItemType Directory -Force -Path $StageRoot|Out-Null
}

$Results=@()
$Failed=0

foreach($Item in @($Plan.plans)){
    $Id=[string]$Item.packageId
    $PackageStage=Join-Path $StageRoot $Id

    try{
        if(!(Test-Path -LiteralPath $PackageStage)){
            New-Item -ItemType Directory -Force -Path $PackageStage|Out-Null
        }

        $Manifest=[ordered]@{
            packageId=$Id
            fromVersion=[string]$Item.fromVersion
            toVersion=[string]$Item.toVersion
            channel=[string]$Item.channel
            requiresSnapshot=[bool]$Item.requiresSnapshot
            requiresCertification=[bool]$Item.requiresCertification
            stagedAt=(Get-Date).ToString('o')
            status='STAGED'
        }

        $ManifestPath=Join-Path $PackageStage 'staging-manifest.json'
        $Manifest|ConvertTo-Json -Depth 20|Set-Content -LiteralPath $ManifestPath -Encoding UTF8

        $Results+=[pscustomobject]@{
            packageId=$Id
            stagePath=$PackageStage
            manifest=$ManifestPath
            passed=$true
        }

        Write-UPDPass "$Id staged"
    }catch{
        $Failed++
        $Results+=[pscustomobject]@{
            packageId=$Id
            stagePath=$PackageStage
            manifest=''
            passed=$false
            error=$_.Exception.Message
        }
        Write-UPDFail "$Id staging failed: $($_.Exception.Message)"
    }
}

$Report=[ordered]@{
    release='MOS5-019'
    module='UPD-009'
    generatedAt=(Get-Date).ToString('o')
    stagedCount=@($Results|Where-Object passed).Count
    failedCount=$Failed
    passed=($Failed-eq0)
    results=$Results
}

$Path=Write-UPDJson -Data $Report -FileName 'UPD-009-Staging.json'

if($Failed-gt0){
    Write-UPDFail "Staging failed. Report: $Path"
    exit 1
}

Write-UPDPass "Staging completed. Report: $Path"
exit 0
