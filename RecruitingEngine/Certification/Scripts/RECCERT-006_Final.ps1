$ErrorActionPreference='Stop'
. 'D:\MelroseOS\GitHub\MelroseOS\RecruitingEngine\Certification\Core\RECCERT-000_Common.ps1'

Write-RECCertHeader 'RECCERT-006 Final'

$Required=@(
 'RECCERT-001-Structure.json',
 'RECCERT-002-ModuleInventory.json',
 'RECCERT-003-SourceSafety.json',
 'RECCERT-004-BrandingLREC.json',
 'RECCERT-005-Repository.json'
)

$Failed=0
$Checks=@()

foreach($Name in $Required){
    $Path=Join-Path $Global:REC_REPORTS $Name
    $Pass=$false
    $Detail='Missing'
    if(Test-Path -LiteralPath $Path){
        try{
            $D=Get-Content -LiteralPath $Path -Raw|ConvertFrom-Json
            $Pass=[bool]$D.passed
            $Detail=if($Pass){'PASS'}else{'Source certification failed'}
        }catch{
            $Detail=$_.Exception.Message
        }
    }
    if(!$Pass){$Failed++}
    $Checks += [pscustomobject]@{report=$Name;passed=$Pass;detail=$Detail}
    if($Pass){Write-RECCertPass $Name}else{Write-RECCertFail "$Name - $Detail"}
}

$Report=[ordered]@{
    release='MOS5-021'
    certification='RECCERT-006'
    generatedAt=(Get-Date).ToString('o')
    overallStatus=if($Failed-eq0){'SOURCE_CERTIFIED'}else{'NOT_CERTIFIED'}
    failedCertifications=$Failed
    passed=($Failed-eq0)
    productionEmailEnabled=$false
    note='This certifies repository source readiness only. Apps Script deployment/test-email approval remain required before production launch.'
    checks=$Checks
}

$Out=Write-RECCertJson -Data $Report -FileName 'RECCERT-006-Final.json'

Write-Host ''
Write-Host '=========================================================='
Write-Host ' MOS5-021 SOURCE CERTIFICATION RESULT'
Write-Host '=========================================================='
Write-Host ''
Write-Host "Status: $($Report.overallStatus)"
Write-Host "Failed Certifications: $Failed"
Write-Host "Production Email Enabled: FALSE"
Write-Host "Report: $Out"
Write-Host ''

if($Failed){exit 1}
exit 0
