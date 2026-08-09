<#
MelroseOS Enterprise
Module : LM-022_DataQuality
Release: MOS5-016
#>
$ErrorActionPreference='Stop'
$Root='D:\MelroseOS\GitHub\MelroseOS'
$Common=Join-Path $Root 'CoreModules\LM-000_Common.ps1'
if(!(Test-Path $Common)){Write-Host '[FAIL] LM-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common
$Reports=Join-Path (Get-MOSLeadMigrationRoot) 'Reports'
$Normalized=Join-Path $Reports 'NormalizedLeads.json'
$Output=Join-Path $Reports 'DataQuality.json'
function Get-MOSQualityScore{
 param($Lead)
 $score=100;$reasons=@()
 if([string]::IsNullOrWhiteSpace([string]$Lead.Email)){$score-=20;$reasons+='EMAIL_MISSING'}
 if([string]::IsNullOrWhiteSpace([string]$Lead.Phone)){$score-=20;$reasons+='PHONE_MISSING'}
 if([string]::IsNullOrWhiteSpace([string]$Lead.FirstName) -and [string]::IsNullOrWhiteSpace([string]$Lead.LastName)){$score-=15;$reasons+='NAME_MISSING'}
 if([string]::IsNullOrWhiteSpace([string]$Lead.LeadType) -or $Lead.LeadType -eq 'UNKNOWN'){$score-=20;$reasons+='LEAD_TYPE_UNKNOWN'}
 if([int]$Lead.Confidence -lt 60){$score-=25;$reasons+='LOW_CONFIDENCE'}
 if($score-lt0){$score=0}
 [pscustomobject]@{
  Fingerprint=[string]$Lead.Fingerprint;QualityScore=$score
  Grade=if($score-ge90){'A'}elseif($score-ge80){'B'}elseif($score-ge70){'C'}elseif($score-ge60){'D'}else{'F'}
  Issues=$reasons;ReadyForImport=($score-ge80 -and $reasons.Count-eq0)
  RequiresBrokerReview=($score-lt80 -or $reasons.Count-gt0)
 }
}
function Invoke-MOSDataQuality{
 Write-MOSHeader 'LM-022 Data Quality'
 if(!(Test-Path $Normalized)){Write-MOSError 'NormalizedLeads.json not found.';exit 1}
 $data=Get-Content $Normalized -Raw|ConvertFrom-Json
 $rows=@()
 foreach($lead in @($data.leads)){$rows+=Get-MOSQualityScore $lead}
 $ready=@($rows|Where-Object{$_.ReadyForImport}).Count
 $review=@($rows|Where-Object{$_.RequiresBrokerReview}).Count
 [ordered]@{
  release='MOS5-016';module='LM-022';generatedAt=(Get-Date).ToString('o')
  recordCount=$rows.Count;readyForImportCount=$ready;brokerReviewCount=$review
  records=$rows;previewOnly=$true;importEnabled=$false;crmWritesEnabled=$false
  outboundEnabled=$false;safetyLock='ENABLED';nextModule='LM-023_Importer'
 }|ConvertTo-Json -Depth 40|Set-Content $Output -Encoding UTF8
 Write-MOSSuccess 'LM-022 Data Quality Ready'
}
Invoke-MOSDataQuality
exit 0
