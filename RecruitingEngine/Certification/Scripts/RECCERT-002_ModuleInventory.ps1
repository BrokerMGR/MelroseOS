$ErrorActionPreference='Stop'
. 'D:\MelroseOS\GitHub\MelroseOS\RecruitingEngine\Certification\Core\RECCERT-000_Common.ps1'

Write-RECCertHeader 'RECCERT-002 Module Inventory'

$Expected=@(
 'REC-000_Common.gs',
 'REC-001_SpreadsheetConnector.gs',
 'REC-002_RecruitSchema.gs',
 'REC-003_Deduplication.gs',
 'REC-004_SuppressionGate.gs',
 'REC-005_EmailBuilder.gs',
 'REC-005A_BrandAssets.gs',
 'REC-006_ReplyClassifier.gs',
 'REC-007_TestMailer.gs',
 'REC-008_CampaignQueue.gs',
 'REC-009_GmailSender.gs',
 'REC-010_ReplyMonitor.gs',
 'REC-011_LRECVerifier.gs',
 'REC-011A_LRECWriter.gs',
 'REC-012_StateEngine.gs',
 'REC-013_BrokerDashboard.gs',
 'REC-014_OperationsDiagnostics.gs',
 'REC-015_Scheduler.gs',
 'REC-016_LaunchControl.gs',
 'REC-017_ActiveAgentHandoff.gs',
 'REC-018_LRECDiagnostics.gs'
)

$Root=Join-Path $Global:REC_ROOT 'AppsScript'
$Checks=@()
$Failed=0

foreach($Name in $Expected){
    $Path=Join-Path $Root $Name
    $Exists=Test-Path -LiteralPath $Path
    $Size=if($Exists){(Get-Item -LiteralPath $Path).Length}else{0}
    $Pass=$Exists -and $Size -gt 250
    if(!$Pass){$Failed++}
    $Checks += [pscustomobject]@{file=$Name;exists=$Exists;size=$Size;passed=$Pass}
    if($Pass){Write-RECCertPass "$Name - $Size bytes"}else{Write-RECCertFail "$Name - missing/undersized"}
}

$Manifest=Join-Path $Root 'appsscript.json'
$ManifestPass=(Test-Path -LiteralPath $Manifest) -and ((Get-Item -LiteralPath $Manifest).Length -gt 50)
if(!$ManifestPass){$Failed++}

if($ManifestPass){Write-RECCertPass 'appsscript.json'}else{Write-RECCertFail 'appsscript.json'}

$Report=[ordered]@{
    release='MOS5-021'
    certification='RECCERT-002'
    expectedModuleCount=$Expected.Count
    failedCount=$Failed
    passed=($Failed-eq0)
    checks=$Checks
}

$Out=Write-RECCertJson -Data $Report -FileName 'RECCERT-002-ModuleInventory.json'
if($Failed){Write-RECCertFail "Module inventory failed. Report: $Out";exit 1}
Write-RECCertPass "Module inventory passed. Report: $Out"
exit 0
