<#
MelroseOS Enterprise
Module : LM-024_Exporter
Release: MOS5-016
#>
$ErrorActionPreference='Stop'
$Root='D:\MelroseOS\GitHub\MelroseOS'
$Common=Join-Path $Root 'CoreModules\LM-000_Common.ps1'
if(!(Test-Path $Common)){Write-Host '[FAIL] LM-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

$LMRoot=Get-MOSLeadMigrationRoot
$Reports=Join-Path $LMRoot 'Reports'
$Exports=Join-Path $LMRoot 'Exports'
$ImportPreview=Join-Path $Reports 'ImportPreview.json'
$Output=Join-Path $Reports 'ExportManifest.json'

Test-MOSFolder $Exports|Out-Null

function Invoke-MOSExporter {
 Write-MOSHeader 'LM-024 Exporter'
 if(!(Test-Path $ImportPreview)){Write-MOSError 'ImportPreview.json not found.';exit 1}

 $data=Get-Content $ImportPreview -Raw|ConvertFrom-Json
 $stamp=(Get-Date).ToString('yyyyMMdd-HHmmss')
 $csv=Join-Path $Exports "LeadImportPreview-$stamp.csv"

 $rows=@($data.records)
 if($rows.Count -gt 0){
  $rows |
   Select-Object Fingerprint,FirstName,LastName,Email,Phone,PropertyAddress,LeadType,Source,BrokerOnly,ReadyForImport,ImportState |
   Export-Csv -LiteralPath $csv -NoTypeInformation -Encoding UTF8
 }else{
  'Fingerprint,FirstName,LastName,Email,Phone,PropertyAddress,LeadType,Source,BrokerOnly,ReadyForImport,ImportState' |
   Set-Content -LiteralPath $csv -Encoding UTF8
 }

 [ordered]@{
  release='MOS5-016';module='LM-024';generatedAt=(Get-Date).ToString('o')
  exportFile=$csv;exportRecordCount=$rows.Count
  previewOnly=$true;containsNoWriteCommands=$true
  crmWritesEnabled=$false;outboundEnabled=$false;safetyLock='ENABLED'
  nextModule='LM-025_Reporting'
 }|ConvertTo-Json -Depth 20|Set-Content $Output -Encoding UTF8

 Write-MOSSuccess 'LM-024 Exporter Ready'
}
Invoke-MOSExporter
exit 0
