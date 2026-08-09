<#
MelroseOS Enterprise
Update Manager Module : UPD-008_DownloadManager
Release: MOS5-019
#>

$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\UpdateManager\Core\UPD-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){
    Write-Host '[FAIL] UPD-000_Common.ps1 not found.' -ForegroundColor Red
    exit 1
}
. $Common

Write-UPDHeader 'UPD-008 Download Manager'

$PlanPath=Join-Path $Global:UPD_REPORTS 'UPD-007-UpdatePlan.json'
if(!(Test-Path -LiteralPath $PlanPath)){
    Write-UPDFail "Update plan not found: $PlanPath"
    exit 1
}

$Plan=Get-Content -LiteralPath $PlanPath -Raw|ConvertFrom-Json
$Config=Get-UPDConfig
$AutoDownload=([string]$Config['AUTO_DOWNLOAD'] -eq 'TRUE')

$DownloadedRoot=Join-Path $Global:UPD_MANAGER 'Packages\Downloaded'
if(!(Test-Path -LiteralPath $DownloadedRoot)){
    New-Item -ItemType Directory -Force -Path $DownloadedRoot|Out-Null
}

$Results=@()
$Failed=0

foreach($Item in @($Plan.plans)){
    $Id=[string]$Item.packageId
    $Target=Join-Path $DownloadedRoot $Id
    $Result='DOWNLOAD_BLOCKED_BY_SAFE_MODE'
    $Passed=$true

    if($AutoDownload){
        try{
            if(!(Test-Path -LiteralPath $Target)){
                New-Item -ItemType Directory -Force -Path $Target|Out-Null
            }

            $Manifest=[ordered]@{
                packageId=$Id
                fromVersion=[string]$Item.fromVersion
                toVersion=[string]$Item.toVersion
                channel=[string]$Item.channel
                downloadedAt=(Get-Date).ToString('o')
                source='LOCAL_PACKAGE_REGISTRY'
                status='STAGED_DOWNLOAD_METADATA'
            }

            $ManifestPath=Join-Path $Target 'download-manifest.json'
            $Manifest|ConvertTo-Json -Depth 20|Set-Content -LiteralPath $ManifestPath -Encoding UTF8
            $Result='DOWNLOAD_METADATA_CREATED'
        }catch{
            $Passed=$false
            $Failed++
            $Result=$_.Exception.Message
        }
    }

    $Results += [pscustomobject]@{
        packageId=$Id
        autoDownload=$AutoDownload
        targetPath=$Target
        result=$Result
        passed=$Passed
    }

    if($Passed){
        Write-UPDPass "$Id : $Result"
    }else{
        Write-UPDFail "$Id : $Result"
    }
}

$Report=[ordered]@{
    release='MOS5-019'
    module='UPD-008'
    generatedAt=(Get-Date).ToString('o')
    autoDownload=$AutoDownload
    safeMode=($Config['MODE'])
    failedCount=$Failed
    passed=($Failed-eq0)
    downloads=$Results
}

$Path=Write-UPDJson -Data $Report -FileName 'UPD-008-DownloadManager.json'

if($Failed-gt0){
    Write-UPDFail "Download Manager failed. Report: $Path"
    exit 1
}

Write-UPDPass "Download Manager completed. Report: $Path"
exit 0
