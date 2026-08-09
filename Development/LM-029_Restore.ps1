<#
MelroseOS Enterprise
Module : LM-029_Restore
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
$Output=Join-Path $Reports 'RestorePreview.json'

function Get-MOSLatestBackup {
 if(!(Test-Path $Backups)){return $null}
 Get-ChildItem -LiteralPath $Backups -Directory -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
}

function Invoke-MOSRestore {
 Write-MOSHeader 'LM-029 Restore'
 Test-MOSFolder $Reports|Out-Null
 Test-MOSFolder $Backups|Out-Null

 $latest=Get-MOSLatestBackup

 [ordered]@{
  release='MOS5-016'
  module='LM-029'
  generatedAt=(Get-Date).ToString('o')
  latestBackup=if($latest){$latest.FullName}else{''}
  backupAvailable=[bool]($null-ne$latest)
  restoreExecutionEnabled=$false
  destructiveActionsEnabled=$false
  previewOnly=$true
  crmWritesEnabled=$false
  outboundEnabled=$false
  safetyLock='ENABLED'
  nextModule='LM-030_ReleaseManager'
 }|ConvertTo-Json -Depth 20|Set-Content -LiteralPath $Output -Encoding UTF8

 Write-MOSSuccess 'LM-029 Restore Preview Ready'
}
Invoke-MOSRestore
exit 0
