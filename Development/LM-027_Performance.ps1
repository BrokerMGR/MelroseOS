<#
MelroseOS Enterprise
Module : LM-027_Performance
Release: MOS5-016
#>
$ErrorActionPreference='Stop'
$Root='D:\MelroseOS\GitHub\MelroseOS'
$Common=Join-Path $Root 'CoreModules\LM-000_Common.ps1'
if(!(Test-Path $Common)){Write-Host '[FAIL] LM-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

$LMRoot=Get-MOSLeadMigrationRoot
$Reports=Join-Path $LMRoot 'Reports'
$Output=Join-Path $Reports 'Performance.json'

function Measure-MOSJsonFile {
 param([string]$Name,[string]$Path)

 $exists=Test-Path -LiteralPath $Path
 $size=0
 $elapsed=0
 $records=0

 if($exists){
  $size=(Get-Item -LiteralPath $Path).Length
  $sw=[Diagnostics.Stopwatch]::StartNew()
  try{
   $data=Get-Content -LiteralPath $Path -Raw|ConvertFrom-Json
   if($data.records){$records=@($data.records).Count}
   elseif($data.leads){$records=@($data.leads).Count}
   elseif($data.entities){$records=@($data.entities).Count}
   elseif($data.queue){$records=@($data.queue).Count}
   elseif($data.events){$records=@($data.events).Count}
  }finally{
   $sw.Stop()
   $elapsed=$sw.ElapsedMilliseconds
  }
 }

 [pscustomobject]@{
  Name=$Name
  Path=$Path
  Exists=$exists
  SizeBytes=$size
  RecordCount=$records
  ReadMilliseconds=$elapsed
 }
}

function Invoke-MOSPerformance {
 Write-MOSHeader 'LM-027 Performance'
 Test-MOSFolder $Reports|Out-Null

 $targets=@(
  @{N='MessageInventory';P=Join-Path $Reports 'MessageInventory.json'}
  @{N='NormalizedLeads';P=Join-Path $Reports 'NormalizedLeads.json'}
  @{N='DuplicateDetection';P=Join-Path $Reports 'DuplicateDetection.json'}
  @{N='BrokerReviewQueue';P=Join-Path $Reports 'BrokerReviewQueue.json'}
  @{N='DataQuality';P=Join-Path $Reports 'DataQuality.json'}
  @{N='ImportPreview';P=Join-Path $Reports 'ImportPreview.json'}
 )

 $rows=@()
 foreach($t in $targets){$rows+=Measure-MOSJsonFile -Name $t.N -Path $t.P}

 $totalBytes=($rows|Measure-Object SizeBytes -Sum).Sum
 $totalMs=($rows|Measure-Object ReadMilliseconds -Sum).Sum

 [ordered]@{
  release='MOS5-016'
  module='LM-027'
  generatedAt=(Get-Date).ToString('o')
  totalFiles=$rows.Count
  totalBytes=[int64]$totalBytes
  totalReadMilliseconds=[int64]$totalMs
  metrics=$rows
  previewOnly=$true
  crmWritesEnabled=$false
  outboundEnabled=$false
  nextModule='LM-028_Backup'
 }|ConvertTo-Json -Depth 30|Set-Content -LiteralPath $Output -Encoding UTF8

 Write-MOSSuccess 'LM-027 Performance Ready'
}
Invoke-MOSPerformance
exit 0
