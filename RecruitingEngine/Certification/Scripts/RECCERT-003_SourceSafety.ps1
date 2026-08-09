$ErrorActionPreference='Stop'
. 'D:\MelroseOS\GitHub\MelroseOS\RecruitingEngine\Certification\Core\RECCERT-000_Common.ps1'

Write-RECCertHeader 'RECCERT-003 Source Safety'

$Common=Join-Path $Global:REC_ROOT 'AppsScript\REC-000_Common.gs'
$Gate=Join-Path $Global:REC_ROOT 'AppsScript\REC-004_SuppressionGate.gs'
$Sender=Join-Path $Global:REC_ROOT 'AppsScript\REC-009_GmailSender.gs'
$Reply=Join-Path $Global:REC_ROOT 'AppsScript\REC-006_ReplyClassifier.gs'
$Launch=Join-Path $Global:REC_ROOT 'AppsScript\REC-016_LaunchControl.gs'

$Checks=@(
    [pscustomobject]@{name='Sandbox mode';path=$Common;pattern="mode: 'SANDBOX'"},
    [pscustomobject]@{name='Outbound false';path=$Common;pattern='outboundEnabled: false'},
    [pscustomobject]@{name='Monday-Saturday';path=$Gate;pattern='allowedWeekdays: [1, 2, 3, 4, 5, 6]'},
    [pscustomobject]@{name='Start 10AM';path=$Gate;pattern='startHour: 10'},
    [pscustomobject]@{name='End 4PM';path=$Gate;pattern='endHour: 16'},
    [pscustomobject]@{name='Holiday skip';path=$Gate;pattern='skipHolidays: true'},
    [pscustomobject]@{name='Sender time gate';path=$Sender;pattern='REC_assertProductionSendAllowed_'},
    [pscustomobject]@{name='STOP becomes DNC';path=$Reply;pattern='markDNC: true'},
    [pscustomobject]@{name='STOP unsubscribed';path=$Reply;pattern='markUnsubscribed: true'},
    [pscustomobject]@{name='Two-key launch enabled';path=$Launch;pattern='REC_PRODUCTION_ENABLED'},
    [pscustomobject]@{name='Two-key launch approved';path=$Launch;pattern='REC_PRODUCTION_APPROVED'}
)

$Failed=0
$Results=@()

foreach($Check in $Checks){
    $Pass=$false
    if(Test-Path -LiteralPath $Check.path){
        $Text=Get-Content -LiteralPath $Check.path -Raw
        $Pass=$Text.Contains($Check.pattern)
    }
    if(!$Pass){$Failed++}
    $Results += [pscustomobject]@{check=$Check.name;passed=$Pass;pattern=$Check.pattern}
    if($Pass){Write-RECCertPass $Check.name}else{Write-RECCertFail $Check.name}
}

$Report=[ordered]@{
    release='MOS5-021'
    certification='RECCERT-003'
    failedCount=$Failed
    passed=($Failed-eq0)
    checks=$Results
}

$Out=Write-RECCertJson -Data $Report -FileName 'RECCERT-003-SourceSafety.json'
if($Failed){Write-RECCertFail "Source safety failed. Report: $Out";exit 1}
Write-RECCertPass "Source safety passed. Report: $Out"
exit 0
