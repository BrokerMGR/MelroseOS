<#
MelroseOS Enterprise
Module : LM-023_Importer
Release: MOS5-016
#>
$ErrorActionPreference='Stop'
$Root='D:\MelroseOS\GitHub\MelroseOS'
$Common=Join-Path $Root 'CoreModules\LM-000_Common.ps1'
if(!(Test-Path $Common)){Write-Host '[FAIL] LM-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

$Reports=Join-Path (Get-MOSLeadMigrationRoot) 'Reports'
$Normalized=Join-Path $Reports 'NormalizedLeads.json'
$Quality=Join-Path $Reports 'DataQuality.json'
$Output=Join-Path $Reports 'ImportPreview.json'

function Invoke-MOSImporter {
 Write-MOSHeader 'LM-023 Importer'
 if(!(Test-Path $Normalized)){Write-MOSError 'NormalizedLeads.json not found.';exit 1}
 if(!(Test-Path $Quality)){Write-MOSError 'DataQuality.json not found.';exit 1}

 $norm=Get-Content $Normalized -Raw|ConvertFrom-Json
 $quality=Get-Content $Quality -Raw|ConvertFrom-Json

 $qualityMap=@{}
 foreach($q in @($quality.records)){
  $qualityMap[[string]$q.Fingerprint]=$q
 }

 $rows=@()
 foreach($lead in @($norm.leads)){
  $q=$qualityMap[[string]$lead.Fingerprint]
  $ready=$false
  if($q){$ready=[bool]$q.ReadyForImport}

  $rows+=[pscustomobject]@{
   Fingerprint=[string]$lead.Fingerprint
   FirstName=[string]$lead.FirstName
   LastName=[string]$lead.LastName
   Email=[string]$lead.Email
   Phone=[string]$lead.Phone
   PropertyAddress=[string]$lead.PropertyAddress
   LeadType=[string]$lead.LeadType
   Source=[string]$lead.Source
   BrokerOnly=[bool]$lead.BrokerOnly
   ReadyForImport=$ready
   ImportState=if($ready){'READY'}else{'HOLD_FOR_REVIEW'}
   ImportExecuted=$false
  }
 }

 $readyCount=@($rows|Where-Object{$_.ReadyForImport}).Count

 [ordered]@{
  release='MOS5-016';module='LM-023';generatedAt=(Get-Date).ToString('o')
  recordCount=$rows.Count;readyCount=$readyCount;holdCount=($rows.Count-$readyCount)
  records=$rows;previewOnly=$true;importEnabled=$false;crmWritesEnabled=$false
  leadAssignmentsEnabled=$false;outboundEnabled=$false;safetyLock='ENABLED'
  nextModule='LM-024_Exporter'
 }|ConvertTo-Json -Depth 40|Set-Content $Output -Encoding UTF8

 Write-MOSSuccess 'LM-023 Importer Preview Ready'
}
Invoke-MOSImporter
exit 0
