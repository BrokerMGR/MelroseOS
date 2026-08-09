<#
MelroseOS Enterprise
Module : LM-030_ReleaseManager
Release: MOS5-016
#>
$ErrorActionPreference='Stop'
$Root='D:\MelroseOS\GitHub\MelroseOS'
$Common=Join-Path $Root 'CoreModules\LM-000_Common.ps1'
if(!(Test-Path $Common)){Write-Host '[FAIL] LM-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

$LMRoot=Get-MOSLeadMigrationRoot
$Reports=Join-Path $LMRoot 'Reports'
$Active=Join-Path $LMRoot 'Active'
$Output=Join-Path $Reports 'ReleaseManifest.json'

function Get-MOSModuleInventory {
 $rows=@()
 foreach($file in @(Get-ChildItem -LiteralPath $Active -Filter 'LM-*.ps1' -File -ErrorAction SilentlyContinue | Sort-Object Name)){
  $rows+=[pscustomobject]@{
   Name=$file.Name
   Path=$file.FullName
   SizeBytes=$file.Length
   LastWriteTime=$file.LastWriteTime.ToString('o')
  }
 }
 $rows
}

function Invoke-MOSReleaseManager {
 Write-MOSHeader 'LM-030 Release Manager'
 Test-MOSFolder $Reports|Out-Null

 $modules=Get-MOSModuleInventory
 $expected=31
 $status=if($modules.Count-eq$expected){'READY'}else{'REVIEW_REQUIRED'}

 [ordered]@{
  release='MOS5-016'
  module='LM-030'
  generatedAt=(Get-Date).ToString('o')
  expectedModuleCount=$expected
  activeModuleCount=$modules.Count
  status=$status
  modules=$modules
  previewOnly=$true
  crmWritesEnabled=$false
  outboundEnabled=$false
  safetyLock='ENABLED'
  leadMigrationEngineComplete=($modules.Count-eq$expected)
 }|ConvertTo-Json -Depth 30|Set-Content -LiteralPath $Output -Encoding UTF8

 if($modules.Count-ne$expected){
  Write-MOSWarning "Expected $expected active modules; found $($modules.Count)."
 }else{
  Write-MOSSuccess 'LM-030 Release Manager Ready'
  Write-MOSSuccess 'MOS5-016 Lead Migration module inventory complete'
 }
}
Invoke-MOSReleaseManager
exit 0
