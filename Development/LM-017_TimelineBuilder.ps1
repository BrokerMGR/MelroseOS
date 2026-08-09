<#
MelroseOS Enterprise
Module : LM-017_TimelineBuilder
Release: MOS5-016
#>
$ErrorActionPreference='Stop'
$Root='D:\MelroseOS\GitHub\MelroseOS'
$Common=Join-Path $Root 'CoreModules\LM-000_Common.ps1'
if(!(Test-Path $Common)){Write-Host '[FAIL] LM-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

$Reports=Join-Path (Get-MOSLeadMigrationRoot) 'Reports'
$Conversations=Join-Path $Reports 'ConversationGroups.json'
$Output=Join-Path $Reports 'LeadTimeline.json'

function Invoke-MOSTimelineBuilder {
 Write-MOSHeader 'LM-017 Timeline Builder'
 if(!(Test-Path $Conversations)){Write-MOSError 'ConversationGroups.json not found.';exit 1}

 $data=Get-Content $Conversations -Raw|ConvertFrom-Json
 $timelines=@()

 foreach($conversation in @($data.conversations)){
  $events=@($conversation.Events | Sort-Object EventAt)

  $timelines+=[pscustomobject]@{
   TimelineId=[guid]::NewGuid().ToString()
   ConversationId=[string]$conversation.ConversationId
   ThreadId=[string]$conversation.ThreadId
   LeadFingerprints=@($conversation.LeadFingerprints)
   EventCount=$events.Count
   StartedAt=if($events.Count){$events[0].EventAt}else{''}
   LastActivityAt=if($events.Count){$events[-1].EventAt}else{''}
   Events=$events
   TimelineState='READY_FOR_AGENT_RESOLUTION'
   ImmutableSourceHistory=$true
  }
 }

 [ordered]@{
  release='MOS5-016';module='LM-017';generatedAt=(Get-Date).ToString('o')
  timelineCount=$timelines.Count
  timelines=$timelines
  previewOnly=$true
  crmWritesEnabled=$false
  leadAssignmentsEnabled=$false
  outboundEnabled=$false
  safetyLock='ENABLED'
  nextModule='LM-018_AgentResolver'
 }|ConvertTo-Json -Depth 40|Set-Content $Output -Encoding UTF8

 Write-MOSSuccess 'LM-017 Timeline Builder Ready'
}
Invoke-MOSTimelineBuilder
exit 0
