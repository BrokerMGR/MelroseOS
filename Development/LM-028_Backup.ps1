<#
MelroseOS Enterprise
Module : LM-028_Backup
Release: MOS5-016
#>
$ErrorActionPreference='Stop'
$Root='D:\MelroseOS\GitHub\MelroseOS'
$Common=Join-Path $Root 'CoreModules\LM-000_Common.ps1'
if(!(Test-Path $Common)){Write-Host '[FAIL] LM-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

$LMRoot=Get-MOSLeadMigrationRoot
$Reports=Join-Path $LMRoot 'Reports'
$Backups=Join-Path $LMRoot 'Backups'
$Output=Join-Path $Reports 'BackupPreview.json'

function Invoke-MOSBackup {
 Write-MOSHeader 'LM-028 Backup'
 Test-MOSFolder $Reports|Out-Null
 Test-MOSFolder $Backups|Out-Null

 $stamp=(Get-Date).ToString('yyyyMMdd-HHmmss')
 $planned=Join-Path $Backups "LeadMigration-$stamp"

 $sources=@(
  [pscustomobject]@{Name='Development';Path=Join-Path $Root 'Development';Exists=Test-Path (Join-Path $Root 'Development')},
  [pscustomobject]@{Name='CoreModules';Path=Join-Path $Root 'CoreModules';Exists=Test-Path (Join-Path $Root 'CoreModules')},
  [pscustomobject]@{Name='Active';Path=Join-Path $LMRoot 'Active';Exists=Test-Path (Join-Path $LMRoot 'Active')},
  [pscustomobject]@{Name='Reports';Path=$Reports;Exists=Test-Path $Reports}
 )

 [ordered]@{
  release='MOS5-016'
  module='LM-028'
  generatedAt=(Get-Date).ToString('o')
  plannedBackupPath=$planned
  sources=$sources
  previewOnly=$true
  backupExecutionEnabled=$false
  destructiveActionsEnabled=$false
  crmWritesEnabled=$false
  outboundEnabled=$false
  safetyLock='ENABLED'
  nextModule='LM-029_Restore'
 }|ConvertTo-Json -Depth 30|Set-Content -LiteralPath $Output -Encoding UTF8

 Write-MOSSuccess 'LM-028 Backup Preview Ready'
}
Invoke-MOSBackup
exit 0
