<#
MelroseOS Enterprise
Module : LM-003_MessageInventory
Release: MOS5-016
#>
$ErrorActionPreference='Stop'
$Root='D:\MelroseOS\GitHub\MelroseOS'
$Common=Join-Path $Root 'CoreModules\LM-000_Common.ps1'
if(!(Test-Path $Common)){Write-Host '[FAIL] LM-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common
$Reports=Join-Path (Get-MOSLeadMigrationRoot) 'Reports'
Test-MOSFolder $Reports|Out-Null
$Discovery=Join-Path $Reports 'GmailDiscovery.json'
$Output=Join-Path $Reports 'MessageInventory.json'
function Get-MOSMessageFingerprint{
 param([string]$MessageId,[string]$ThreadId,[string]$From,[string]$Subject,[string]$InternalDate)
 $s="$MessageId|$ThreadId|$From|$Subject|$InternalDate".ToLowerInvariant()
 $sha=[Security.Cryptography.SHA256]::Create()
 try{([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($s)))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
}
function Invoke-MOSMessageInventory{
 Write-MOSHeader 'LM-003 Message Inventory'
 if(!(Test-Path $Discovery)){Write-MOSError 'GmailDiscovery.json not found.';exit 1}
 $d=Get-Content $Discovery -Raw|ConvertFrom-Json
 $boxes=@()
 foreach($m in @($d.mailboxes)){
  $boxes+=[pscustomobject]@{Mailbox=[string]$m.Email;Role=[string]$m.Role;Priority=[int]$m.Priority;MessageCount=0;Messages=@()}
 }
 [ordered]@{
  release='MOS5-016';module='LM-003';generatedAt=(Get-Date).ToString('o')
  previewOnly=$true;gmailReadsEnabled=$false;crmWritesEnabled=$false;outboundEnabled=$false
  mailboxCount=$boxes.Count;totalMessages=0;mailboxes=$boxes;nextModule='LM-004_LeadExtraction'
 }|ConvertTo-Json -Depth 30|Set-Content $Output -Encoding UTF8
 Write-MOSSuccess 'LM-003 Message Inventory Ready'
}
Invoke-MOSMessageInventory
exit 0
