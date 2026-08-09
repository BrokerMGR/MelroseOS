<#
MelroseOS Enterprise
Update Manager Module : UPD-017_CertificationGate
Release: MOS5-019
#>

$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\UpdateManager\Core\UPD-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){
    Write-Host '[FAIL] UPD-000_Common.ps1 not found.' -ForegroundColor Red
    exit 1
}
. $Common

Write-UPDHeader 'UPD-017 Certification Gate'

$Config=Get-UPDConfig
$Required=([string]$Config['REQUIRE_CERTIFICATION'] -eq 'TRUE')

$LeadCert='D:\MelroseOS\GitHub\MelroseOS\tools\LeadMigration\Certification\Reports\CERT-015-Final.json'
$PkgCert='D:\MelroseOS\GitHub\MelroseOS\PackageManager\Certification\Reports\PKGCERT-012-Final.json'

$Checks=@()
$Failed=0

foreach($Item in @(
    [pscustomobject]@{name='LeadMigration';path=$LeadCert},
    [pscustomobject]@{name='PackageManager';path=$PkgCert}
)){
    $Exists=Test-Path -LiteralPath $Item.path
    $Certified=$false
    $Details='Missing'

    if($Exists){
        try{
            $Data=Get-Content -LiteralPath $Item.path -Raw|ConvertFrom-Json
            $Certified=([bool]$Data.passed)
            if($Data.PSObject.Properties.Name -contains 'overallStatus'){
                $Certified=$Certified -and ([string]$Data.overallStatus -eq 'CERTIFIED')
            }
            $Details=if($Certified){'CERTIFIED'}else{'NOT_CERTIFIED'}
        }catch{
            $Details=$_.Exception.Message
        }
    }

    $Passed=(-not $Required) -or $Certified
    if(-not $Passed){$Failed++}

    $Checks += [pscustomobject]@{
        subsystem=$Item.name
        path=$Item.path
        exists=$Exists
        certified=$Certified
        certificationRequired=$Required
        passed=$Passed
        details=$Details
    }

    if($Passed){
        Write-UPDPass "$($Item.name): $Details"
    }else{
        Write-UPDFail "$($Item.name): $Details"
    }
}

$Report=[ordered]@{
    release='MOS5-019'
    module='UPD-017'
    generatedAt=(Get-Date).ToString('o')
    certificationRequired=$Required
    failedCount=$Failed
    passed=($Failed-eq0)
    checks=$Checks
}

$Path=Write-UPDJson -Data $Report -FileName 'UPD-017-CertificationGate.json'

if($Failed-gt0){
    Write-UPDFail "Certification gate failed. Report: $Path"
    exit 1
}

Write-UPDPass "Certification gate passed. Report: $Path"
exit 0
