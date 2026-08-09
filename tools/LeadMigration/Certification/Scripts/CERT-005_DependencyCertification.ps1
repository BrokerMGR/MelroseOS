<#
MelroseOS Enterprise
Certification : CERT-005
Name          : Dependency Certification
Release       : MOS5-017A
#>

$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\tools\LeadMigration\Certification\Core\CERT-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){Write-Host '[FAIL] CERT-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

Write-CertHeader 'CERT-005 Dependency Certification'

$Expected = [ordered]@{
 'LM-002'='GmailDiscovery.json'
 'LM-003'='MessageInventory.json'
 'LM-004'='LeadExtraction.json'
 'LM-005'='LeadParser.json'
 'LM-006'='EntityRecognition.json'
 'LM-007'='NormalizedLeads.json'
 'LM-008'='DuplicateDetection.json'
 'LM-009'='MergePlan.json'
 'LM-010'='CRMWritePreview.json'
 'LM-011'='CRMValidation.json'
 'LM-012'='AttachmentDiscovery.json'
 'LM-013'='AttachmentProcessing.json'
 'LM-014'='LabelManagement.json'
 'LM-015'='LeadHistory.json'
 'LM-016'='ConversationGroups.json'
 'LM-017'='LeadTimeline.json'
 'LM-018'='AgentResolution.json'
 'LM-019'='BrokerReviewQueue.json'
 'LM-020'='ComplianceScan.json'
 'LM-021'='ExceptionQueue.json'
 'LM-022'='DataQuality.json'
 'LM-023'='ImportPreview.json'
 'LM-024'='ExportManifest.json'
 'LM-025'='MigrationSummary.json'
 'LM-026'='Diagnostics.json'
 'LM-027'='Performance.json'
 'LM-028'='BackupPreview.json'
 'LM-029'='RestorePreview.json'
 'LM-030'='ReleaseManifest.json'
}

$Inventory=Get-CertModuleInventory
$Results=@()

foreach($kv in $Expected.GetEnumerator()){
    $num=[int]($kv.Key.Substring(3))
    $m=$Inventory|Where-Object Number -eq $num
    $passed=$false
    $details='Module missing'
    if($m -and (Test-Path -LiteralPath $m.Path)){
        $text=[IO.File]::ReadAllText($m.Path)
        $passed=$text -match [regex]::Escape($kv.Value)
        $details=if($passed){"References $($kv.Value)"}else{"Expected reference not found: $($kv.Value)"}
    }
    $Results+=New-CertResult -Check "$($kv.Key) -> $($kv.Value)" -Passed $passed -Details $details
    if($passed){Write-CertPass "$($kv.Key) -> $($kv.Value)"}else{Write-CertFail "$($kv.Key) -> $($kv.Value)"}
}

$Failed=@($Results|Where-Object{-not $_.Passed}).Count
$Report=[ordered]@{
 release='MOS5-017A';targetRelease='MOS5-016';certification='CERT-005'
 generatedAt=(Get-Date).ToString('o');failedCount=$Failed;passed=($Failed-eq0);results=$Results
}
$Path=Write-CertJson -Data $Report -FileName 'CERT-005-Dependencies.json'
if($Failed-gt0){Write-CertFail "Dependency certification failed. Report: $Path";exit 1}
Write-CertPass "Dependency certification passed. Report: $Path"
exit 0
