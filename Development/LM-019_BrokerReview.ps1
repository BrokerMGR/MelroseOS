<#
MelroseOS Enterprise
Module : LM-019_BrokerReview
Release: MOS5-016
#>
$ErrorActionPreference='Stop'
$Root='D:\MelroseOS\GitHub\MelroseOS'
$Common=Join-Path $Root 'CoreModules\LM-000_Common.ps1'
if(!(Test-Path $Common)){Write-Host '[FAIL] LM-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common
$Reports=Join-Path (Get-MOSLeadMigrationRoot) 'Reports'
$AgentResolution=Join-Path $Reports 'AgentResolution.json'
$CRMValidation=Join-Path $Reports 'CRMValidation.json'
$DuplicateDetection=Join-Path $Reports 'DuplicateDetection.json'
$Output=Join-Path $Reports 'BrokerReviewQueue.json'
function Add-MOSBrokerReviewItem{
 param([System.Collections.ArrayList]$Queue,[string]$Category,[string]$ReferenceId,[string]$Reason,[string]$Severity='NORMAL')
 [void]$Queue.Add([pscustomobject]@{
  ReviewId=[guid]::NewGuid().ToString();Category=$Category;ReferenceId=$ReferenceId
  Reason=$Reason;Severity=$Severity;Status='PENDING_BROKER_REVIEW'
  CreatedAt=(Get-Date).ToString('o');ResolvedAt='';Resolution=''
 })
}
function Invoke-MOSBrokerReview{
 Write-MOSHeader 'LM-019 Broker Review'
 $queue=[System.Collections.ArrayList]::new()
 if(Test-Path $AgentResolution){
  $agent=Get-Content $AgentResolution -Raw|ConvertFrom-Json
  foreach($r in @($agent.resolutions)){
   if($r.RequiresBrokerReview){
    Add-MOSBrokerReviewItem $queue 'AGENT_RESOLUTION' ([string]$r.TimelineId) ([string]$r.ResolutionReason) 'NORMAL'
   }
  }
 }
 if(Test-Path $CRMValidation){
  $crm=Get-Content $CRMValidation -Raw|ConvertFrom-Json
  foreach($r in @($crm.results)){
   if(-not $r.Valid){
    Add-MOSBrokerReviewItem $queue 'CRM_VALIDATION' ([string]$r.Fingerprint) (($r.Issues -join ',')) 'HIGH'
   }
  }
 }
 if(Test-Path $DuplicateDetection){
  $dup=Get-Content $DuplicateDetection -Raw|ConvertFrom-Json
  foreach($r in @($dup.records)){
   if($r.IsDuplicate){
    Add-MOSBrokerReviewItem $queue 'DUPLICATE' ([string]$r.MessageId) ("Duplicate of "+[string]$r.DuplicateOf) 'HIGH'
   }
  }
 }
 [ordered]@{
  release='MOS5-016';module='LM-019';generatedAt=(Get-Date).ToString('o')
  queueCount=$queue.Count;queue=@($queue);previewOnly=$true
  brokerApprovalRequired=$true;crmWritesEnabled=$false;outboundEnabled=$false
  safetyLock='ENABLED';nextModule='LM-020_ComplianceScanner'
 }|ConvertTo-Json -Depth 40|Set-Content $Output -Encoding UTF8
 Write-MOSSuccess 'LM-019 Broker Review Queue Ready'
}
Invoke-MOSBrokerReview
exit 0
