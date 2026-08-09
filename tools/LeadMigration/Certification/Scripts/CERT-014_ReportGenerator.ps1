<#
MelroseOS Enterprise
Certification : CERT-014
Name          : Report Generator
Release       : MOS5-017A
#>

$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\tools\LeadMigration\Certification\Core\CERT-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){Write-Host '[FAIL] CERT-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

Write-CertHeader 'CERT-014 Report Generator'

$Reports='D:\MelroseOS\GitHub\MelroseOS\tools\LeadMigration\Certification\Reports'
if(!(Test-Path -LiteralPath $Reports)){New-Item -ItemType Directory -Force -Path $Reports|Out-Null}

$SourceFiles=@(Get-ChildItem -LiteralPath $Reports -Filter 'CERT-0*.json' -File -ErrorAction SilentlyContinue | Sort-Object Name)
$Rows=@()

foreach($file in $SourceFiles){
    try{
        $data=Get-Content -LiteralPath $file.FullName -Raw|ConvertFrom-Json
        $Rows+=[pscustomobject]@{
            File=$file.Name
            Certification=[string]$data.certification
            Passed=[bool]$data.passed
            FailedCount=if($null-ne$data.failedCount){[int]$data.failedCount}else{0}
        }
    }catch{
        $Rows+=[pscustomobject]@{
            File=$file.Name
            Certification='UNKNOWN'
            Passed=$false
            FailedCount=1
        }
    }
}

$PassedCount=@($Rows|Where-Object{$_.Passed}).Count
$FailedCount=@($Rows|Where-Object{-not $_.Passed}).Count

$Summary=[ordered]@{
    release='MOS5-017A'
    targetRelease='MOS5-016'
    certification='CERT-014'
    generatedAt=(Get-Date).ToString('o')
    certificationReports=$Rows.Count
    passedCount=$PassedCount
    failedCount=$FailedCount
    passed=($FailedCount-eq0)
    reports=$Rows
}

$JsonPath=Write-CertJson -Data $Summary -FileName 'CERT-014-Summary.json'

$MarkdownPath=Join-Path $Reports 'CertificationSummary.md'
$Lines=@(
    '# MelroseOS Certification Summary',
    '',
    'Release: MOS5-017A',
    'Target: MOS5-016',
    '',
    "Reports: $($Rows.Count)",
    "Passed: $PassedCount",
    "Failed: $FailedCount",
    '',
    '| Certification | Status | Failed Checks |',
    '|---|---:|---:|'
)

foreach($row in $Rows){
    $status=if($row.Passed){'PASS'}else{'FAIL'}
    $Lines+="| $($row.Certification) | $status | $($row.FailedCount) |"
}

$Lines|Set-Content -LiteralPath $MarkdownPath -Encoding UTF8

Write-CertPass "JSON summary: $JsonPath"
Write-CertPass "Markdown summary: $MarkdownPath"
exit 0
