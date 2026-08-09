<#
MelroseOS Enterprise
Module : LM-007_Normalization
Release: MOS5-016
#>
$ErrorActionPreference='Stop'
$Root='D:\MelroseOS\GitHub\MelroseOS'
$Common=Join-Path $Root 'CoreModules\LM-000_Common.ps1'
if(!(Test-Path $Common)){Write-Host '[FAIL] LM-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common
$Reports=Join-Path (Get-MOSLeadMigrationRoot) 'Reports'
$InputPath=Join-Path $Reports 'EntityRecognition.json'
$Output=Join-Path $Reports 'NormalizedLeads.json'
function NEmail([string]$v){([string]$v).Trim().ToLowerInvariant()}
function NPhone([string]$v){$d=([string]$v)-replace'\D','';if($d.Length-eq11-and$d.StartsWith('1')){$d=$d.Substring(1)};$d}
function NText([string]$v){[regex]::Replace(([string]$v).Trim(),'\s+',' ')}
function Fingerprint($l){
 $s="$(NEmail $l.Email)|$(NPhone $l.Phone)|$(NText $l.FirstName)|$(NText $l.LastName)|$(NText $l.PropertyAddress)".ToLowerInvariant()
 $sha=[Security.Cryptography.SHA256]::Create()
 try{([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($s)))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
}
function Invoke-MOSNormalization{
 Write-MOSHeader 'LM-007 Normalization'
 if(!(Test-Path $InputPath)){Write-MOSError 'EntityRecognition.json not found.';exit 1}
 $d=Get-Content $InputPath -Raw|ConvertFrom-Json
 $rows=@()
 foreach($l in @($d.entities)){
  $o=[ordered]@{
   MessageId=$l.MessageId;ThreadId=$l.ThreadId;FirstName=NText ([string]$l.FirstName);LastName=NText ([string]$l.LastName)
   Email=NEmail ([string]$l.Email);Phone=NPhone ([string]$l.Phone);PropertyAddress=NText ([string]$l.PropertyAddress)
   Source=([string]$l.Source).ToUpperInvariant();LeadType=([string]$l.LeadType).ToUpperInvariant();Confidence=[int]$l.Confidence
   BrokerOnly=[bool]$l.BrokerOnly;RequiresBrokerReview=[bool]$l.RequiresBrokerReview;NormalizedAt=(Get-Date).ToString('o')
  }
  $o.Fingerprint=Fingerprint ([pscustomobject]$o)
  $rows+=[pscustomobject]$o
 }
 [ordered]@{
  release='MOS5-016';module='LM-007';generatedAt=(Get-Date).ToString('o');normalizedCount=$rows.Count
  leads=$rows;previewOnly=$true;crmWritesEnabled=$false;outboundEnabled=$false;nextModule='LM-008_DuplicateDetection'
 }|ConvertTo-Json -Depth 30|Set-Content $Output -Encoding UTF8
 Write-MOSSuccess 'LM-007 Normalization Ready'
}
Invoke-MOSNormalization
exit 0
