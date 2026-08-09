<#
MelroseOS Enterprise
Module : LM-010_CRMWriter
Release: MOS5-016
#>
$ErrorActionPreference='Stop'
$Root='D:\MelroseOS\GitHub\MelroseOS'
$Common=Join-Path $Root 'CoreModules\LM-000_Common.ps1'
if(!(Test-Path $Common)){Write-Host '[FAIL] LM-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

$Reports=Join-Path (Get-MOSLeadMigrationRoot) 'Reports'
$NormalizedInput=Join-Path $Reports 'NormalizedLeads.json'
$MergeInput=Join-Path $Reports 'MergePlan.json'
$Output=Join-Path $Reports 'CRMWritePreview.json'

function New-MOSCRMWriteRecord{
 param($Lead)

 [pscustomobject]@{
  LeadId=''
  FirstName=[string]$Lead.FirstName
  LastName=[string]$Lead.LastName
  Email=[string]$Lead.Email
  Phone=[string]$Lead.Phone
  PropertyAddress=[string]$Lead.PropertyAddress
  LeadType=[string]$Lead.LeadType
  Source=[string]$Lead.Source
  Fingerprint=[string]$Lead.Fingerprint
  AssignedTo=''
  OwnershipLocked=$false
  MigrationStatus='READY_FOR_VALIDATION'
  WriteExecuted=$false
 }
}

function Invoke-MOSCRMWriter{
 Write-MOSHeader 'LM-010 CRM Writer'
 if(!(Test-Path $NormalizedInput)){Write-MOSError 'NormalizedLeads.json not found.';exit 1}

 $data=Get-Content $NormalizedInput -Raw|ConvertFrom-Json
 $rows=@()

 foreach($lead in @($data.leads)){
  $rows+=New-MOSCRMWriteRecord $lead
 }

 $mergeCount=0
 if(Test-Path $MergeInput){
  $merge=Get-Content $MergeInput -Raw|ConvertFrom-Json
  $mergeCount=[int]$merge.mergeCandidateCount
 }

 [ordered]@{
  release='MOS5-016';module='LM-010';generatedAt=(Get-Date).ToString('o')
  proposedWriteCount=$rows.Count
  mergeCandidateCount=$mergeCount
  records=$rows
  previewOnly=$true
  crmWritesEnabled=$false
  leadAssignmentsEnabled=$false
  outboundEnabled=$false
  safetyLock='ENABLED'
  nextModule='LM-011_CRMValidator'
 }|ConvertTo-Json -Depth 30|Set-Content $Output -Encoding UTF8

 Write-MOSSuccess 'LM-010 CRM Write Preview Ready'
}
Invoke-MOSCRMWriter
exit 0
