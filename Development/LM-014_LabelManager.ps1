<#
MelroseOS Enterprise
Module : LM-014_LabelManager
Release: MOS5-016
#>
$ErrorActionPreference='Stop'
$Root='D:\MelroseOS\GitHub\MelroseOS'
$Common=Join-Path $Root 'CoreModules\LM-000_Common.ps1'
if(!(Test-Path $Common)){Write-Host '[FAIL] LM-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

$Reports=Join-Path (Get-MOSLeadMigrationRoot) 'Reports'
$Discovery=Join-Path $Reports 'GmailDiscovery.json'
$Output=Join-Path $Reports 'LabelManagement.json'

$CanonicalLabels=@(
 'MGR/New Leads',
 'MGR/Processed',
 'MGR/Needs Review',
 'MGR/Buyer',
 'MGR/Seller',
 'MGR/Renter',
 'MGR/Recruiting',
 'MGR/Archive'
)

function New-MOSLabelPlan {
 param([string]$Mailbox,[string]$Label)

 [pscustomobject]@{
  Mailbox=$Mailbox
  Label=$Label
  Exists=$false
  CreateRequested=$false
  MutationExecuted=$false
  Status='DISCOVERY_ONLY'
 }
}

function Invoke-MOSLabelManager {
 Write-MOSHeader 'LM-014 Label Manager'
 if(!(Test-Path $Discovery)){Write-MOSError 'GmailDiscovery.json not found.';exit 1}

 $data=Get-Content $Discovery -Raw|ConvertFrom-Json
 $plans=@()

 foreach($mailbox in @($data.mailboxes)){
  foreach($label in $CanonicalLabels){
   $plans+=New-MOSLabelPlan -Mailbox ([string]$mailbox.Email) -Label $label
  }
 }

 [ordered]@{
  release='MOS5-016';module='LM-014';generatedAt=(Get-Date).ToString('o')
  canonicalLabels=$CanonicalLabels
  planCount=$plans.Count
  plans=$plans
  previewOnly=$true
  gmailMutationsEnabled=$false
  crmWritesEnabled=$false
  outboundEnabled=$false
  safetyLock='ENABLED'
  nextModule='LM-015_HistoryBuilder'
 }|ConvertTo-Json -Depth 30|Set-Content $Output -Encoding UTF8

 Write-MOSSuccess 'LM-014 Label Manager Ready'
}
Invoke-MOSLabelManager
exit 0
