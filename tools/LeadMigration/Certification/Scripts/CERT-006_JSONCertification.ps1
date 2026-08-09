<#
MelroseOS Enterprise
Certification : CERT-006
Name          : JSON Certification
Release       : MOS5-017A
#>

$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\tools\LeadMigration\Certification\Core\CERT-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){Write-Host '[FAIL] CERT-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

Write-CertHeader 'CERT-006 JSON Certification'

$ReportRoot='D:\MelroseOS\GitHub\MelroseOS\tools\LeadMigration\Reports'
$JsonFiles=@(Get-ChildItem -LiteralPath $ReportRoot -Filter '*.json' -File -ErrorAction SilentlyContinue)
$Results=@()

foreach($file in $JsonFiles){
    $passed=$true
    $details='Valid JSON'
    try{
        $raw=Get-Content -LiteralPath $file.FullName -Raw
        if([string]::IsNullOrWhiteSpace($raw)){throw 'File is empty'}
        $null=$raw|ConvertFrom-Json
    }catch{
        $passed=$false
        $details=$_.Exception.Message
    }

    $Results+=[pscustomobject]@{
        File=$file.Name
        Path=$file.FullName
        SizeBytes=$file.Length
        Passed=$passed
        Details=$details
    }

    if($passed){Write-CertPass $file.Name}else{Write-CertFail "$($file.Name): $details"}
}

$Failed=@($Results|Where-Object{-not $_.Passed}).Count
$Report=[ordered]@{
 release='MOS5-017A';targetRelease='MOS5-016';certification='CERT-006'
 generatedAt=(Get-Date).ToString('o');jsonFileCount=$Results.Count
 failedCount=$Failed;passed=($Failed-eq0);results=$Results
}
$Path=Write-CertJson -Data $Report -FileName 'CERT-006-JSON.json'
if($Failed-gt0){Write-CertFail "JSON certification failed. Report: $Path";exit 1}
Write-CertPass "JSON certification passed. Report: $Path"
exit 0
