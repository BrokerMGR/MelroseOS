<#
MelroseOS Enterprise
Module : LM-008_DuplicateDetection
Release: MOS5-016
#>
$ErrorActionPreference='Stop'
$Root='D:\MelroseOS\GitHub\MelroseOS'
$Common=Join-Path $Root 'CoreModules\LM-000_Common.ps1'
if(!(Test-Path $Common)){Write-Host '[FAIL] LM-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

$Reports=Join-Path (Get-MOSLeadMigrationRoot) 'Reports'
$Input=Join-Path $Reports 'NormalizedLeads.json'
$Output=Join-Path $Reports 'DuplicateDetection.json'

function Get-MOSDuplicateKey {
 param($Lead)
 if($Lead.Fingerprint){return [string]$Lead.Fingerprint}
 $email=([string]$Lead.Email).Trim().ToLowerInvariant()
 $phone=(([string]$Lead.Phone)-replace'\D','')
 "$email|$phone|$(([string]$Lead.PropertyAddress).Trim().ToLowerInvariant())"
}

function Invoke-MOSDuplicateDetection{
 Write-MOSHeader 'LM-008 Duplicate Detection'
 if(!(Test-Path $Input)){Write-MOSError 'NormalizedLeads.json not found.';exit 1}

 $d=Get-Content $Input -Raw|ConvertFrom-Json
 $seen=@{}
 $rows=@()

 foreach($lead in @($d.leads)){
  $key=Get-MOSDuplicateKey $lead
  $dup=$false;$first=''

  if($seen.ContainsKey($key)){
   $dup=$true
   $first=$seen[$key]
  }else{
   $seen[$key]=[string]$lead.MessageId
  }

  $rows+=[pscustomobject]@{
   MessageId=[string]$lead.MessageId
   ThreadId=[string]$lead.ThreadId
   Fingerprint=[string]$lead.Fingerprint
   Email=[string]$lead.Email
   Phone=[string]$lead.Phone
   PropertyAddress=[string]$lead.PropertyAddress
   LeadType=[string]$lead.LeadType
   IsDuplicate=$dup
   DuplicateOf=$first
   RequiresBrokerReview=[bool]($dup -or $lead.RequiresBrokerReview)
  }
 }

 [ordered]@{
  release='MOS5-016';module='LM-008';generatedAt=(Get-Date).ToString('o')
  recordCount=$rows.Count
  duplicateCount=@($rows|Where-Object{$_.IsDuplicate}).Count
  records=$rows
  previewOnly=$true
  crmWritesEnabled=$false
  outboundEnabled=$false
  nextModule='LM-009_MergeEngine'
 }|ConvertTo-Json -Depth 30|Set-Content $Output -Encoding UTF8

 Write-MOSSuccess 'LM-008 Duplicate Detection Ready'
}
Invoke-MOSDuplicateDetection
exit 0
