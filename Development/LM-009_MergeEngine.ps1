<#
MelroseOS Enterprise
Module : LM-009_MergeEngine
Release: MOS5-016
#>
$ErrorActionPreference='Stop'
$Root='D:\MelroseOS\GitHub\MelroseOS'
$Common=Join-Path $Root 'CoreModules\LM-000_Common.ps1'
if(!(Test-Path $Common)){Write-Host '[FAIL] LM-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

$Reports=Join-Path (Get-MOSLeadMigrationRoot) 'Reports'
$DupInput=Join-Path $Reports 'DuplicateDetection.json'
$NormInput=Join-Path $Reports 'NormalizedLeads.json'
$Output=Join-Path $Reports 'MergePlan.json'

function Get-MOSPreferredValue {
 param([object[]]$Values)
 foreach($v in $Values){
  if(-not [string]::IsNullOrWhiteSpace([string]$v)){return [string]$v}
 }
 ''
}

function Invoke-MOSMergeEngine{
 Write-MOSHeader 'LM-009 Merge Engine'
 if(!(Test-Path $DupInput)){Write-MOSError 'DuplicateDetection.json not found.';exit 1}
 if(!(Test-Path $NormInput)){Write-MOSError 'NormalizedLeads.json not found.';exit 1}

 $dup=Get-Content $DupInput -Raw|ConvertFrom-Json
 $norm=Get-Content $NormInput -Raw|ConvertFrom-Json
 $lookup=@{}
 foreach($l in @($norm.leads)){$lookup[[string]$l.MessageId]=$l}

 $plans=@()

 foreach($r in @($dup.records)){
  if(-not $r.IsDuplicate){continue}

  $current=$lookup[[string]$r.MessageId]
  $original=$lookup[[string]$r.DuplicateOf]

  if($null -eq $current -or $null -eq $original){continue}

  $plans+=[pscustomobject]@{
   PrimaryMessageId=[string]$original.MessageId
   DuplicateMessageId=[string]$current.MessageId
   Fingerprint=[string]$current.Fingerprint
   ProposedFirstName=Get-MOSPreferredValue @($original.FirstName,$current.FirstName)
   ProposedLastName=Get-MOSPreferredValue @($original.LastName,$current.LastName)
   ProposedEmail=Get-MOSPreferredValue @($original.Email,$current.Email)
   ProposedPhone=Get-MOSPreferredValue @($original.Phone,$current.Phone)
   ProposedPropertyAddress=Get-MOSPreferredValue @($original.PropertyAddress,$current.PropertyAddress)
   LeadType=Get-MOSPreferredValue @($original.LeadType,$current.LeadType)
   PreserveOwnership=$true
   Action='BROKER_REVIEW_REQUIRED'
   MergeExecuted=$false
  }
 }

 [ordered]@{
  release='MOS5-016';module='LM-009';generatedAt=(Get-Date).ToString('o')
  mergeCandidateCount=$plans.Count
  mergePlans=$plans
  previewOnly=$true
  mergeExecutionEnabled=$false
  crmWritesEnabled=$false
  outboundEnabled=$false
  nextModule='LM-010_CRMWriter'
 }|ConvertTo-Json -Depth 30|Set-Content $Output -Encoding UTF8

 Write-MOSSuccess 'LM-009 Merge Engine Ready'
}
Invoke-MOSMergeEngine
exit 0
