<#
MelroseOS Enterprise
Module : LM-018_AgentResolver
Release: MOS5-016
#>
$ErrorActionPreference='Stop'
$Root='D:\MelroseOS\GitHub\MelroseOS'
$Common=Join-Path $Root 'CoreModules\LM-000_Common.ps1'
if(!(Test-Path $Common)){Write-Host '[FAIL] LM-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common
$Reports=Join-Path (Get-MOSLeadMigrationRoot) 'Reports'
$Timeline=Join-Path $Reports 'LeadTimeline.json'
$Output=Join-Path $Reports 'AgentResolution.json'
$BrokerId='BROKER-001'
$BrokerName='Ulysses A. Barnes, Jr.'
function Resolve-MOSAgent{
 param($TimelineRecord)
 [pscustomobject]@{
  TimelineId=[string]$TimelineRecord.TimelineId
  ConversationId=[string]$TimelineRecord.ConversationId
  ThreadId=[string]$TimelineRecord.ThreadId
  LeadFingerprints=@($TimelineRecord.LeadFingerprints)
  ResolvedAgentId=$BrokerId
  ResolvedAgentName=$BrokerName
  ResolutionReason='BROKER_FALLBACK_PREVIEW'
  ExistingOwnershipPreserved=$true
  AssignmentExecuted=$false
  RequiresBrokerReview=$true
 }
}
function Invoke-MOSAgentResolver{
 Write-MOSHeader 'LM-018 Agent Resolver'
 if(!(Test-Path $Timeline)){Write-MOSError 'LeadTimeline.json not found.';exit 1}
 $data=Get-Content $Timeline -Raw|ConvertFrom-Json
 $rows=@()
 foreach($timeline in @($data.timelines)){$rows+=Resolve-MOSAgent $timeline}
 [ordered]@{
  release='MOS5-016';module='LM-018';generatedAt=(Get-Date).ToString('o')
  resolutionCount=$rows.Count;resolutions=$rows;previewOnly=$true
  leadAssignmentsEnabled=$false;preserveExistingOwnership=$true
  crmWritesEnabled=$false;outboundEnabled=$false;safetyLock='ENABLED'
  nextModule='LM-019_BrokerReview'
 }|ConvertTo-Json -Depth 40|Set-Content $Output -Encoding UTF8
 Write-MOSSuccess 'LM-018 Agent Resolver Ready'
}
Invoke-MOSAgentResolver
exit 0
