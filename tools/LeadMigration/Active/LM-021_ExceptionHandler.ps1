<#
MelroseOS Enterprise
Module : LM-021_ExceptionHandler
Release: MOS5-016
#>
$ErrorActionPreference='Stop'
$Root='D:\MelroseOS\GitHub\MelroseOS'
$Common=Join-Path $Root 'CoreModules\LM-000_Common.ps1'
if(!(Test-Path $Common)){Write-Host '[FAIL] LM-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common
$Reports=Join-Path (Get-MOSLeadMigrationRoot) 'Reports'
$Compliance=Join-Path $Reports 'ComplianceScan.json'
$BrokerReview=Join-Path $Reports 'BrokerReviewQueue.json'
$Output=Join-Path $Reports 'ExceptionQueue.json'
function New-MOSException{
 param([string]$Source,[string]$ReferenceId,[string]$Type,[string]$Details,[string]$Severity='NORMAL')
 [pscustomobject]@{
  ExceptionId=[guid]::NewGuid().ToString();Source=$Source;ReferenceId=$ReferenceId
  ExceptionType=$Type;Details=$Details;Severity=$Severity;Status='OPEN'
  RetryAllowed=$false;RequiresBrokerReview=$true;CreatedAt=(Get-Date).ToString('o')
 }
}
function Invoke-MOSExceptionHandler{
 Write-MOSHeader 'LM-021 Exception Handler'
 $rows=@()
 if(Test-Path $Compliance){
  $data=Get-Content $Compliance -Raw|ConvertFrom-Json
  foreach($r in @($data.records)){
   foreach($issue in @($r.Issues)){
    $rows+=New-MOSException 'COMPLIANCE' ([string]$r.Fingerprint) ([string]$issue) 'Compliance validation issue' 'HIGH'
   }
  }
 }
 if(Test-Path $BrokerReview){
  $review=Get-Content $BrokerReview -Raw|ConvertFrom-Json
  foreach($r in @($review.queue)){
   if($r.Severity -eq 'HIGH'){
    $rows+=New-MOSException 'BROKER_REVIEW' ([string]$r.ReferenceId) ([string]$r.Category) ([string]$r.Reason) 'HIGH'
   }
  }
 }
 [ordered]@{
  release='MOS5-016';module='LM-021';generatedAt=(Get-Date).ToString('o')
  exceptionCount=$rows.Count;exceptions=$rows;previewOnly=$true
  automaticRetriesEnabled=$false;crmWritesEnabled=$false;outboundEnabled=$false
  safetyLock='ENABLED';nextModule='LM-022_DataQuality'
 }|ConvertTo-Json -Depth 40|Set-Content $Output -Encoding UTF8
 Write-MOSSuccess 'LM-021 Exception Handler Ready'
}
Invoke-MOSExceptionHandler
exit 0
