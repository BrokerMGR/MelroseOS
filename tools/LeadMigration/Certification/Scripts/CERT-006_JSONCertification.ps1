<#
MelroseOS Enterprise
Certification : CERT-006
Name          : JSON Certification
Version       : 2.0.0
Release       : MOS5-017A
Target        : MOS5-016
#>

$ErrorActionPreference='Stop'

$Root='D:\MelroseOS\GitHub\MelroseOS'
$CertRoot=Join-Path $Root 'tools\LeadMigration\Certification'
$Common=Join-Path $CertRoot 'Core\CERT-000_Common.ps1'
$ConfigRoot=Join-Path $CertRoot 'Config'
$ReportsRoot=Join-Path $Root 'tools\LeadMigration\Reports'
$ProfilePath=Join-Path $ConfigRoot 'CertificationProfile.json'

if(!(Test-Path -LiteralPath $Common)){
    Write-Host '[FAIL] CERT-000_Common.ps1 not found.' -ForegroundColor Red
    exit 1
}

. $Common

Write-CertHeader 'CERT-006 JSON Certification v2.0'

if(!(Test-Path -LiteralPath $ProfilePath)){
    Write-CertFail "Certification profile not found: $ProfilePath"
    exit 1
}

try{
    $Profile=Get-Content -LiteralPath $ProfilePath -Raw | ConvertFrom-Json
}catch{
    Write-CertFail "CertificationProfile.json is invalid JSON."
    exit 1
}

$ValidateReports=@($Profile.validateReports)
$IgnoreReports=@($Profile.ignoreReports)

if($ValidateReports.Count -eq 0){
    Write-CertFail 'Certification profile contains no validateReports entries.'
    exit 1
}

$Results=@()

foreach($Name in $ValidateReports){
    $Path=Join-Path $ReportsRoot $Name
    $Exists=Test-Path -LiteralPath $Path
    $Passed=$false
    $Details=''

    if(-not $Exists){
        $Details='Required report missing'
    }
    else{
        try{
            $Raw=Get-Content -LiteralPath $Path -Raw

            if([string]::IsNullOrWhiteSpace($Raw)){
                throw 'File is empty'
            }

            $null=$Raw | ConvertFrom-Json
            $Passed=$true
            $Details='Valid JSON'
        }
        catch{
            $Details=$_.Exception.Message
        }
    }

    $Results+=[pscustomobject]@{
        File=$Name
        Path=$Path
        Required=$true
        Exists=$Exists
        Passed=$Passed
        Details=$Details
    }

    if($Passed){
        Write-CertPass $Name
    }else{
        Write-CertFail "$Name : $Details"
    }
}

$Ignored=@()

foreach($Name in $IgnoreReports){
    $Path=Join-Path $ReportsRoot $Name
    $Exists=Test-Path -LiteralPath $Path

    $Ignored+=[pscustomobject]@{
        File=$Name
        Path=$Path
        Exists=$Exists
        Ignored=$true
    }

    if($Exists){
        Write-CertInfo "Ignoring approved non-certification report: $Name"
    }
}

$Failed=@($Results | Where-Object { -not $_.Passed }).Count

$Report=[ordered]@{
    release='MOS5-017A'
    targetRelease='MOS5-016'
    certification='CERT-006'
    version='2.0.0'
    generatedAt=(Get-Date).ToString('o')
    profile=$ProfilePath
    requiredReportCount=$Results.Count
    failedCount=$Failed
    ignoredReportCount=$Ignored.Count
    passed=($Failed-eq0)
    results=$Results
    ignored=$Ignored
}

$ReportPath=Write-CertJson -Data $Report -FileName 'CERT-006-JSON.json'

if($Failed-gt0){
    Write-CertFail "JSON certification failed. Report: $ReportPath"
    exit 1
}

Write-CertPass "JSON certification passed. Report: $ReportPath"
exit 0
