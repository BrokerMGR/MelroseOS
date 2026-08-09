$ErrorActionPreference='Stop'
. 'D:\MelroseOS\GitHub\MelroseOS\RecruitingEngine\Certification\Core\RECCERT-000_Common.ps1'

Write-RECCertHeader 'RECCERT-004 Branding and LREC'

$Checks=@()
$Failed=0

function AddCheck($Name,$Pass,$Detail){
    if(!$Pass){$script:Failed++}
    $script:Checks += [pscustomobject]@{check=$Name;passed=$Pass;detail=$Detail}
    if($Pass){Write-RECCertPass "$Name - $Detail"}else{Write-RECCertFail "$Name - $Detail"}
}

$Logo=Join-Path $Global:REC_ROOT 'Branding\MGR-Recruiting-Logo.jpg'
$Card=Join-Path $Global:REC_ROOT 'Branding\Ulysses-Barnes-Broker-Business-Card.jpg'
AddCheck 'Logo asset' ((Test-Path $Logo) -and ((Get-Item $Logo).Length -gt 5000)) $Logo
AddCheck 'Business card asset' ((Test-Path $Card) -and ((Get-Item $Card).Length -gt 5000)) $Card

$EmailBuilder=Join-Path $Global:REC_ROOT 'AppsScript\REC-005_EmailBuilder.gs'
$MailText=if(Test-Path $EmailBuilder){Get-Content $EmailBuilder -Raw}else{''}
AddCheck 'CID logo' ($MailText.Contains('cid:')) 'Inline CID image support'
AddCheck 'Compliance footer' ($MailText.Contains('Licensed in Louisiana')) 'Louisiana brokerage footer'
AddCheck 'Unsubscribe footer' ($MailText.Contains('Unsubscribe from recruiting emails')) 'Unsubscribe link text'

$LREC=Join-Path $Global:REC_ROOT 'AppsScript\REC-011_LRECVerifier.gs'
$LRECText=if(Test-Path $LREC){Get-Content $LREC -Raw}else{''}
AddCheck 'LREC public search' ($LRECText.Contains('https://portal.lrec.gov/public/search')) 'Public search configured'
AddCheck 'LREC rate limit' ($LRECText.Contains('minDelayMs: 2500')) '2.5 second minimum'
AddCheck 'Ambiguous review gate' ($LRECText.Contains('REVIEW_REQUIRED')) 'No guessed ACTIVE transitions'

$Report=[ordered]@{
    release='MOS5-021'
    certification='RECCERT-004'
    failedCount=$Failed
    passed=($Failed-eq0)
    checks=$Checks
}

$Out=Write-RECCertJson -Data $Report -FileName 'RECCERT-004-BrandingLREC.json'
if($Failed){Write-RECCertFail "Branding/LREC certification failed. Report: $Out";exit 1}
Write-RECCertPass "Branding/LREC certification passed. Report: $Out"
exit 0
