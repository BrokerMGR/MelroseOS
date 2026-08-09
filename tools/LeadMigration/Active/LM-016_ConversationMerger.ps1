<#
MelroseOS Enterprise
Module : LM-016_ConversationMerger
Release: MOS5-016
#>
$ErrorActionPreference='Stop'
$Root='D:\MelroseOS\GitHub\MelroseOS'
$Common=Join-Path $Root 'CoreModules\LM-000_Common.ps1'
if(!(Test-Path $Common)){Write-Host '[FAIL] LM-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

$Reports=Join-Path (Get-MOSLeadMigrationRoot) 'Reports'
$History=Join-Path $Reports 'LeadHistory.json'
$Normalized=Join-Path $Reports 'NormalizedLeads.json'
$Output=Join-Path $Reports 'ConversationGroups.json'

function Invoke-MOSConversationMerger {
 Write-MOSHeader 'LM-016 Conversation Merger'
 if(!(Test-Path $History)){Write-MOSError 'LeadHistory.json not found.';exit 1}
 if(!(Test-Path $Normalized)){Write-MOSError 'NormalizedLeads.json not found.';exit 1}

 $history=Get-Content $History -Raw|ConvertFrom-Json
 $normalized=Get-Content $Normalized -Raw|ConvertFrom-Json

 $byThread=@{}

 foreach($event in @($history.events)){
  $thread=[string]$event.ThreadId
  if([string]::IsNullOrWhiteSpace($thread)){continue}
  if(-not $byThread.ContainsKey($thread)){$byThread[$thread]=@()}
  $byThread[$thread]+=$event
 }

 $groups=@()

 foreach($thread in $byThread.Keys){
  $events=@($byThread[$thread] | Sort-Object EventAt)
  $groups+=[pscustomobject]@{
   ConversationId=$thread
   ThreadId=$thread
   EventCount=$events.Count
   FirstEventAt=if($events.Count){$events[0].EventAt}else{''}
   LastEventAt=if($events.Count){$events[-1].EventAt}else{''}
   LeadFingerprints=@($events|ForEach-Object{$_.LeadFingerprint}|Where-Object{$_}|Sort-Object -Unique)
   Events=$events
   MergeState='GROUPED'
   MergeExecuted=$false
  }
 }

 [ordered]@{
  release='MOS5-016';module='LM-016';generatedAt=(Get-Date).ToString('o')
  conversationCount=$groups.Count
  conversations=$groups
  previewOnly=$true
  crmWritesEnabled=$false
  outboundEnabled=$false
  nextModule='LM-017_TimelineBuilder'
 }|ConvertTo-Json -Depth 40|Set-Content $Output -Encoding UTF8

 Write-MOSSuccess 'LM-016 Conversation Merger Ready'
}
Invoke-MOSConversationMerger
exit 0
