<#
MelroseOS Enterprise
Module : LM-006_EntityRecognition
Release: MOS5-016
#>
$ErrorActionPreference='Stop'
$Root='D:\MelroseOS\GitHub\MelroseOS'
$Common=Join-Path $Root 'CoreModules\LM-000_Common.ps1'
if(!(Test-Path $Common)){Write-Host '[FAIL] LM-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common
$Reports=Join-Path (Get-MOSLeadMigrationRoot) 'Reports'
$InputPath=Join-Path $Reports 'LeadParser.json'
$Output=Join-Path $Reports 'EntityRecognition.json'
function Get-MOSLeadType([string]$Text){
 $t=([string]$Text).ToLowerInvariant()
 if($t-match'join the team|career|broker sponsorship|real estate license|new agent'){return'RECRUITING'}
 if($t-match'sell|seller|listing|list my home|home value'){return'SELLER'}
 if($t-match'buy|buyer|pre.?approved|home search'){return'BUYER'}
 if($t-match'rent|rental|lease|tenant|apartment'){return'RENTER'}
 'UNKNOWN'
}
function Get-MOSConfidence($r){
 $s=0
 if($r.Email){$s+=35};if($r.Phone){$s+=30};if($r.FirstName){$s+=10};if($r.LastName){$s+=10};if($r.PropertyAddress){$s+=15}
 [Math]::Min(100,$s)
}
function Invoke-MOSEntityRecognition{
 Write-MOSHeader 'LM-006 Entity Recognition'
 if(!(Test-Path $InputPath)){Write-MOSError 'LeadParser.json not found.';exit 1}
 $d=Get-Content $InputPath -Raw|ConvertFrom-Json
 $rows=@()
 foreach($r in @($d.records)){
  $type=Get-MOSLeadType "$($r.Subject)`n$($r.Snippet)"
  $c=Get-MOSConfidence $r
  $rows+=[pscustomobject]@{
   MessageId=$r.MessageId;ThreadId=$r.ThreadId;FirstName=$r.FirstName;LastName=$r.LastName;Email=$r.Email;Phone=$r.Phone
   PropertyAddress=$r.PropertyAddress;Source=$r.Source;LeadType=$type;Confidence=$c;BrokerOnly=($type-eq'RECRUITING')
   RequiresBrokerReview=(($type-eq'UNKNOWN')-or($c-lt60))
  }
 }
 [ordered]@{
  release='MOS5-016';module='LM-006';generatedAt=(Get-Date).ToString('o');entityCount=$rows.Count
  entities=$rows;previewOnly=$true;nextModule='LM-007_Normalization'
 }|ConvertTo-Json -Depth 30|Set-Content $Output -Encoding UTF8
 Write-MOSSuccess 'LM-006 Entity Recognition Ready'
}
Invoke-MOSEntityRecognition
exit 0
