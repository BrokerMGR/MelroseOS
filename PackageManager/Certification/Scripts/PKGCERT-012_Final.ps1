<#
MelroseOS Enterprise
Package Manager Certification
Module : PKGCERT-012_Final
Release: MOS5-018
#>
$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\PackageManager\Certification\Core\PKGCERT-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){Write-Host '[FAIL] PKGCERT-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

Write-PKGCertHeader 'PKGCERT-012 Final'

$Reports=$Global:PKGCERT_REPORTS
$Results=@()
$Failed=0

for($i=1;$i -le 11;$i++){
    $Prefix='PKGCERT-{0:D3}-' -f $i
    $File=Get-ChildItem -LiteralPath $Reports -Filter "$Prefix*.json" -File -ErrorAction SilentlyContinue|Select-Object -First 1

    if(-not $File){
        $Failed++
        $Results+=[pscustomobject]@{
            certification=('PKGCERT-{0:D3}' -f $i)
            passed=$false
            details='Report missing'
        }
        Write-PKGCertFail "$Prefix report missing"
        continue
    }

    try{
        $Data=Get-Content -LiteralPath $File.FullName -Raw|ConvertFrom-Json
        $Passed=[bool]$Data.passed
        if(-not $Passed){$Failed++}

        $Results+=[pscustomobject]@{
            certification=[string]$Data.certification
            passed=$Passed
            details=$File.Name
        }

        if($Passed){Write-PKGCertPass $Data.certification}else{Write-PKGCertFail $Data.certification}
    }catch{
        $Failed++
        $Results+=[pscustomobject]@{
            certification=('PKGCERT-{0:D3}' -f $i)
            passed=$false
            details='Invalid JSON'
        }
        Write-PKGCertFail "$Prefix invalid JSON"
    }
}

$Overall=if($Failed-eq0){'CERTIFIED'}else{'NOT_CERTIFIED'}

$Report=[ordered]@{
    release='MOS5-018'
    certification='PKGCERT-012'
    generatedAt=(Get-Date).ToString('o')
    overallStatus=$Overall
    failedCount=$Failed
    passed=($Failed-eq0)
    results=$Results
}

$Out=Write-PKGCertJson -Data $Report -FileName 'PKGCERT-012-Final.json'

Write-Host ''
Write-Host '=========================================================='
Write-Host ' PACKAGE MANAGER FINAL CERTIFICATION'
Write-Host '=========================================================='
Write-Host ''
Write-Host "Status: $Overall"
Write-Host "Failed Certifications: $Failed"
Write-Host "Report: $Out"
Write-Host ''

if($Failed-gt0){exit 1}
exit 0
