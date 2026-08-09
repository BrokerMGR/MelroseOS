<#
MelroseOS Enterprise
Certification : CERT-015
Name          : Final Certification
Release       : MOS5-017A
#>

$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\tools\LeadMigration\Certification\Core\CERT-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){Write-Host '[FAIL] CERT-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

Write-CertHeader 'CERT-015 Final Certification'

$Reports='D:\MelroseOS\GitHub\MelroseOS\tools\LeadMigration\Certification\Reports'
$Required=1..14|ForEach-Object{'CERT-{0:D3}-' -f $_}
$Results=@()

foreach($prefix in $Required){
    $file=Get-ChildItem -LiteralPath $Reports -Filter "$prefix*.json" -File -ErrorAction SilentlyContinue|Select-Object -First 1

    if(-not $file){
        $Results+=[pscustomobject]@{Certification=$prefix.TrimEnd('-');Passed=$false;Details='Report missing'}
        Write-CertFail "$prefix report missing"
        continue
    }

    try{
        $data=Get-Content -LiteralPath $file.FullName -Raw|ConvertFrom-Json
        $passed=[bool]$data.passed
        $Results+=[pscustomobject]@{
            Certification=[string]$data.certification
            Passed=$passed
            Details=$file.Name
        }

        if($passed){Write-CertPass $data.certification}else{Write-CertFail $data.certification}
    }catch{
        $Results+=[pscustomobject]@{Certification=$prefix.TrimEnd('-');Passed=$false;Details='Invalid JSON'}
        Write-CertFail "$prefix invalid JSON"
    }
}

$Failed=@($Results|Where-Object{-not $_.Passed}).Count
$Overall=if($Failed-eq0){'CERTIFIED'}else{'NOT_CERTIFIED'}

$Report=[ordered]@{
    release='MOS5-017A'
    targetRelease='MOS5-016'
    certification='CERT-015'
    generatedAt=(Get-Date).ToString('o')
    overallStatus=$Overall
    failedCount=$Failed
    passed=($Failed-eq0)
    results=$Results
}

$Path=Write-CertJson -Data $Report -FileName 'CERT-015-Final.json'

Write-Host ''
Write-Host '=========================================================='
Write-Host ' FINAL CERTIFICATION RESULT'
Write-Host '=========================================================='
Write-Host ''
Write-Host "Status: $Overall"
Write-Host "Failed Certifications: $Failed"
Write-Host "Report: $Path"
Write-Host ''

if($Failed-gt0){exit 1}
exit 0
