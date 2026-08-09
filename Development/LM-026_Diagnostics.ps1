<#
MelroseOS Enterprise
Module : LM-026_Diagnostics
Release: MOS5-016
#>
$ErrorActionPreference='Stop'
$Root='D:\MelroseOS\GitHub\MelroseOS'
$Common=Join-Path $Root 'CoreModules\LM-000_Common.ps1'
if(!(Test-Path $Common)){Write-Host '[FAIL] LM-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

$LMRoot=Get-MOSLeadMigrationRoot
$Reports=Join-Path $LMRoot 'Reports'
$Output=Join-Path $Reports 'Diagnostics.json'

function Test-MOSFile {
 param([string]$Name,[string]$Path,[bool]$Required=$true)
 [pscustomobject]@{
  Name=$Name
  Path=$Path
  Required=$Required
  Exists=(Test-Path -LiteralPath $Path)
  Size=if(Test-Path -LiteralPath $Path){(Get-Item -LiteralPath $Path).Length}else{0}
 }
}

function Invoke-MOSDiagnostics {
 Write-MOSHeader 'LM-026 Diagnostics'
 Test-MOSFolder $Reports|Out-Null

 $checks=@(
  Test-MOSFile 'CommonModule' (Join-Path $Root 'CoreModules\LM-000_Common.ps1') $true
  Test-MOSFile 'Development' (Join-Path $Root 'Development') $true
  Test-MOSFile 'Active' (Join-Path $LMRoot 'Active') $true
  Test-MOSFile 'GmailDiscovery' (Join-Path $Reports 'GmailDiscovery.json') $false
  Test-MOSFile 'MessageInventory' (Join-Path $Reports 'MessageInventory.json') $false
  Test-MOSFile 'NormalizedLeads' (Join-Path $Reports 'NormalizedLeads.json') $false
  Test-MOSFile 'DataQuality' (Join-Path $Reports 'DataQuality.json') $false
  Test-MOSFile 'MigrationSummary' (Join-Path $Reports 'MigrationSummary.json') $false
 )

 $requiredFailures=@($checks|Where-Object{$_.Required -and -not $_.Exists}).Count
 $optionalMissing=@($checks|Where-Object{-not $_.Required -and -not $_.Exists}).Count

 $result=[ordered]@{
  release='MOS5-016'
  module='LM-026'
  generatedAt=(Get-Date).ToString('o')
  requiredFailures=$requiredFailures
  optionalMissing=$optionalMissing
  checks=$checks
  previewOnly=$true
  crmWritesEnabled=$false
  outboundEnabled=$false
  status=if($requiredFailures-eq0){'PASS'}else{'FAIL'}
  nextModule='LM-027_Performance'
 }

 $result|ConvertTo-Json -Depth 30|Set-Content -LiteralPath $Output -Encoding UTF8

 if($requiredFailures-gt0){
  Write-MOSError "LM-026 Diagnostics failed with $requiredFailures required failures."
  exit 1
 }

 Write-MOSSuccess 'LM-026 Diagnostics Ready'
}
Invoke-MOSDiagnostics
exit 0
