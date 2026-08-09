<#
MelroseOS Enterprise
Module : LM-020_ComplianceScanner
Release: MOS5-016
#>
$ErrorActionPreference='Stop'
$Root='D:\MelroseOS\GitHub\MelroseOS'
$Common=Join-Path $Root 'CoreModules\LM-000_Common.ps1'
if(!(Test-Path $Common)){Write-Host '[FAIL] LM-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common
$Reports=Join-Path (Get-MOSLeadMigrationRoot) 'Reports'
$Normalized=Join-Path $Reports 'NormalizedLeads.json'
$Output=Join-Path $Reports 'ComplianceScan.json'
function Test-MOSComplianceRecord{
 param($Lead)
 $issues=@()
 if($Lead.LeadType -eq 'RECRUITING' -and -not $Lead.BrokerOnly){$issues+='RECRUITING_NOT_BROKER_ONLY'}
 if([string]::IsNullOrWhiteSpace([string]$Lead.Email) -and [string]::IsNullOrWhiteSpace([string]$Lead.Phone)){$issues+='CONTACT_DATA_MISSING'}
 if([int]$Lead.Confidence -lt 60){$issues+='LOW_CONFIDENCE'}
 [pscustomobject]@{
  Fingerprint=[string]$Lead.Fingerprint;LeadType=[string]$Lead.LeadType
  Passed=($issues.Count-eq0);Issues=$issues;RequiresBrokerReview=($issues.Count-gt0)
  AutomatedActionAllowed=$false
 }
}
function Invoke-MOSComplianceScanner{
 Write-MOSHeader 'LM-020 Compliance Scanner'
 if(!(Test-Path $Normalized)){Write-MOSError 'NormalizedLeads.json not found.';exit 1}
 $data=Get-Content $Normalized -Raw|ConvertFrom-Json
 $rows=@()
 foreach($lead in @($data.leads)){$rows+=Test-MOSComplianceRecord $lead}
 $failed=@($rows|Where-Object{-not $_.Passed}).Count
 [ordered]@{
  release='MOS5-016';module='LM-020';generatedAt=(Get-Date).ToString('o')
  recordCount=$rows.Count;passedCount=($rows.Count-$failed);failedCount=$failed
  records=$rows;previewOnly=$true;automatedActionsEnabled=$false
  crmWritesEnabled=$false;outboundEnabled=$false;safetyLock='ENABLED'
  nextModule='LM-021_ExceptionHandler'
 }|ConvertTo-Json -Depth 40|Set-Content $Output -Encoding UTF8
 Write-MOSSuccess 'LM-020 Compliance Scanner Ready'
}
Invoke-MOSComplianceScanner
exit 0
