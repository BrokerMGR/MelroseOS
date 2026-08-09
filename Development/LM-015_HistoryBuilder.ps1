<#
MelroseOS Enterprise
Module : LM-015_HistoryBuilder
Release: MOS5-016
#>
$ErrorActionPreference='Stop'
$Root='D:\MelroseOS\GitHub\MelroseOS'
$Common=Join-Path $Root 'CoreModules\LM-000_Common.ps1'
if(!(Test-Path $Common)){Write-Host '[FAIL] LM-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

$Reports=Join-Path (Get-MOSLeadMigrationRoot) 'Reports'
$Inventory=Join-Path $Reports 'MessageInventory.json'
$Normalized=Join-Path $Reports 'NormalizedLeads.json'
$Output=Join-Path $Reports 'LeadHistory.json'

function Invoke-MOSHistoryBuilder {
 Write-MOSHeader 'LM-015 History Builder'
 if(!(Test-Path $Inventory)){Write-MOSError 'MessageInventory.json not found.';exit 1}
 if(!(Test-Path $Normalized)){Write-MOSError 'NormalizedLeads.json not found.';exit 1}

 $inventory=Get-Content $Inventory -Raw|ConvertFrom-Json
 $normalized=Get-Content $Normalized -Raw|ConvertFrom-Json

 $leadByMessage=@{}
 foreach($lead in @($normalized.leads)){
  $leadByMessage[[string]$lead.MessageId]=$lead
 }

 $events=@()

 foreach($box in @($inventory.mailboxes)){
  foreach($msg in @($box.Messages)){
   $lead=$leadByMessage[[string]$msg.MessageId]

   $events+=[pscustomobject]@{
    EventId=[guid]::NewGuid().ToString()
    MessageId=[string]$msg.MessageId
    ThreadId=[string]$msg.ThreadId
    Mailbox=[string]$box.Mailbox
    EventType='EMAIL_DISCOVERED'
    EventAt=[string]$msg.InternalDate
    LeadFingerprint=if($lead){[string]$lead.Fingerprint}else{''}
    LeadType=if($lead){[string]$lead.LeadType}else{'UNKNOWN'}
    Immutable=$true
   }
  }
 }

 [ordered]@{
  release='MOS5-016';module='LM-015';generatedAt=(Get-Date).ToString('o')
  eventCount=$events.Count
  events=$events
  immutableHistory=$true
  previewOnly=$true
  crmWritesEnabled=$false
  outboundEnabled=$false
  nextModule='LM-016_ConversationMerger'
 }|ConvertTo-Json -Depth 30|Set-Content $Output -Encoding UTF8

 Write-MOSSuccess 'LM-015 History Builder Ready'
}
Invoke-MOSHistoryBuilder
exit 0
