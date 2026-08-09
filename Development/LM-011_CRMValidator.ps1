<#
MelroseOS Enterprise
Module : LM-011_CRMValidator
Release: MOS5-016
#>
$ErrorActionPreference='Stop'
$Root='D:\MelroseOS\GitHub\MelroseOS'
$Common=Join-Path $Root 'CoreModules\LM-000_Common.ps1'
if(!(Test-Path $Common)){Write-Host '[FAIL] LM-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

$Reports=Join-Path (Get-MOSLeadMigrationRoot) 'Reports'
$Input=Join-Path $Reports 'CRMWritePreview.json'
$Output=Join-Path $Reports 'CRMValidation.json'

function Test-MOSCRMRecord{
 param($Record)

 $issues=@()

 if([string]::IsNullOrWhiteSpace([string]$Record.FirstName) -and
    [string]::IsNullOrWhiteSpace([string]$Record.LastName)){
  $issues+='NAME_MISSING'
 }

 if([string]::IsNullOrWhiteSpace([string]$Record.Email) -and
    [string]::IsNullOrWhiteSpace([string]$Record.Phone)){
  $issues+='CONTACT_MISSING'
 }

 if([string]::IsNullOrWhiteSpace([string]$Record.LeadType)){
  $issues+='LEAD_TYPE_MISSING'
 }

 [pscustomobject]@{
  Fingerprint=[string]$Record.Fingerprint
  Valid=($issues.Count -eq 0)
  Issues=$issues
  RequiresBrokerReview=($issues.Count -gt 0)
 }
}

function Invoke-MOSCRMValidator{
 Write-MOSHeader 'LM-011 CRM Validator'
 if(!(Test-Path $Input)){Write-MOSError 'CRMWritePreview.json not found.';exit 1}

 $data=Get-Content $Input -Raw|ConvertFrom-Json
 $results=@()

 foreach($r in @($data.records)){
  $results+=Test-MOSCRMRecord $r
 }

 $invalid=@($results|Where-Object{-not $_.Valid}).Count

 [ordered]@{
  release='MOS5-016';module='LM-011';generatedAt=(Get-Date).ToString('o')
  recordCount=$results.Count
  validCount=($results.Count-$invalid)
  invalidCount=$invalid
  results=$results
  previewOnly=$true
  crmWritesEnabled=$false
  outboundEnabled=$false
  safetyLock='ENABLED'
  nextModule='LM-012_AttachmentDiscovery'
 }|ConvertTo-Json -Depth 30|Set-Content $Output -Encoding UTF8

 Write-MOSSuccess 'LM-011 CRM Validation Ready'
}
Invoke-MOSCRMValidator
exit 0
