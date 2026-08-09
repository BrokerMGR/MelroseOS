<#
MelroseOS Enterprise
Module : LM-025_Reporting
Release: MOS5-016
#>
$ErrorActionPreference='Stop'
$Root='D:\MelroseOS\GitHub\MelroseOS'
$Common=Join-Path $Root 'CoreModules\LM-000_Common.ps1'
if(!(Test-Path $Common)){Write-Host '[FAIL] LM-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

$Reports=Join-Path (Get-MOSLeadMigrationRoot) 'Reports'
$Output=Join-Path $Reports 'MigrationSummary.json'

function Read-MOSJsonIfExists {
 param([string]$Path)
 if(Test-Path $Path){return (Get-Content $Path -Raw|ConvertFrom-Json)}
 return $null
}

function Invoke-MOSReporting {
 Write-MOSHeader 'LM-025 Reporting'

 $inventory=Read-MOSJsonIfExists (Join-Path $Reports 'MessageInventory.json')
 $normalized=Read-MOSJsonIfExists (Join-Path $Reports 'NormalizedLeads.json')
 $duplicates=Read-MOSJsonIfExists (Join-Path $Reports 'DuplicateDetection.json')
 $review=Read-MOSJsonIfExists (Join-Path $Reports 'BrokerReviewQueue.json')
 $quality=Read-MOSJsonIfExists (Join-Path $Reports 'DataQuality.json')
 $import=Read-MOSJsonIfExists (Join-Path $Reports 'ImportPreview.json')

 $summary=[ordered]@{
  release='MOS5-016'
  module='LM-025'
  generatedAt=(Get-Date).ToString('o')
  messages=if($inventory){[int]$inventory.totalMessages}else{0}
  normalizedLeads=if($normalized){[int]$normalized.normalizedCount}else{0}
  duplicates=if($duplicates){[int]$duplicates.duplicateCount}else{0}
  brokerReviewItems=if($review){[int]$review.queueCount}else{0}
  readyForImport=if($quality){[int]$quality.readyForImportCount}else{0}
  importPreviewRecords=if($import){[int]$import.recordCount}else{0}
  previewOnly=$true
  crmWritesEnabled=$false
  leadAssignmentsEnabled=$false
  outboundEnabled=$false
  safetyLock='ENABLED'
  nextModule='LM-026_Diagnostics'
 }

 $summary|ConvertTo-Json -Depth 20|Set-Content $Output -Encoding UTF8

 Write-Host ''
 Write-Host "Messages          : $($summary.messages)"
 Write-Host "Normalized Leads  : $($summary.normalizedLeads)"
 Write-Host "Duplicates        : $($summary.duplicates)"
 Write-Host "Broker Review     : $($summary.brokerReviewItems)"
 Write-Host "Ready For Import  : $($summary.readyForImport)"
 Write-Host ''
 Write-MOSSuccess 'LM-025 Reporting Ready'
}
Invoke-MOSReporting
exit 0
