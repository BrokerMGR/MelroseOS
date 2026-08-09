<#
MelroseOS Enterprise
Module : LM-004_LeadExtraction
Release: MOS5-016
#>
$ErrorActionPreference='Stop'
$Root='D:\MelroseOS\GitHub\MelroseOS'
$Common=Join-Path $Root 'CoreModules\LM-000_Common.ps1'
if(!(Test-Path $Common)){Write-Host '[FAIL] LM-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common
$Reports=Join-Path (Get-MOSLeadMigrationRoot) 'Reports'
$InputPath=Join-Path $Reports 'MessageInventory.json'
$Output=Join-Path $Reports 'LeadExtraction.json'
function Get-MOSEmails([string]$Text){
 if([string]::IsNullOrWhiteSpace($Text)){return @()}
 @([regex]::Matches($Text,'[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}','IgnoreCase')|ForEach-Object{$_.Value.ToLowerInvariant()}|Sort-Object -Unique)
}
function Get-MOSPhones([string]$Text){
 $o=@()
 foreach($m in [regex]::Matches([string]$Text,'(?:\+?1[\s.\-]?)?(?:\(?\d{3}\)?[\s.\-]?)\d{3}[\s.\-]?\d{4}')){
  $d=$m.Value-replace'\D',''
  if($d.Length-eq11-and$d.StartsWith('1')){$d=$d.Substring(1)}
  if($d.Length-eq10){$o+=$d}
 }
 @($o|Sort-Object -Unique)
}
function Invoke-MOSLeadExtraction{
 Write-MOSHeader 'LM-004 Lead Extraction'
 if(!(Test-Path $InputPath)){Write-MOSError 'MessageInventory.json not found.';exit 1}
 $d=Get-Content $InputPath -Raw|ConvertFrom-Json
 $rows=@()
 foreach($b in @($d.mailboxes)){
  foreach($m in @($b.Messages)){
   $t="$($m.From)`n$($m.Subject)`n$($m.Snippet)"
   $e=Get-MOSEmails $t;$p=Get-MOSPhones $t
   $rows+=[pscustomobject]@{
    Mailbox=$b.Mailbox;MessageId=$m.MessageId;ThreadId=$m.ThreadId;From=$m.From;Subject=$m.Subject;Snippet=$m.Snippet
    PrimaryEmail=if($e.Count){$e[0]}else{''};PrimaryPhone=if($p.Count){$p[0]}else{''}
    Source='EMAIL';RequiresReview=(($e.Count-eq0)-and($p.Count-eq0))
   }
  }
 }
 [ordered]@{
  release='MOS5-016';module='LM-004';generatedAt=(Get-Date).ToString('o');previewOnly=$true;crmWritesEnabled=$false
  candidateCount=$rows.Count;candidates=$rows;nextModule='LM-005_LeadParser'
 }|ConvertTo-Json -Depth 30|Set-Content $Output -Encoding UTF8
 Write-MOSSuccess 'LM-004 Lead Extraction Ready'
}
Invoke-MOSLeadExtraction
exit 0
