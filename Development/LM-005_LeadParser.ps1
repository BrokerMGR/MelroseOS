<#
MelroseOS Enterprise
Module : LM-005_LeadParser
Release: MOS5-016
#>
$ErrorActionPreference='Stop'
$Root='D:\MelroseOS\GitHub\MelroseOS'
$Common=Join-Path $Root 'CoreModules\LM-000_Common.ps1'
if(!(Test-Path $Common)){Write-Host '[FAIL] LM-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common
$Reports=Join-Path (Get-MOSLeadMigrationRoot) 'Reports'
$InputPath=Join-Path $Reports 'LeadExtraction.json'
$Output=Join-Path $Reports 'LeadParser.json'
function Get-MOSName([string]$From){
 $n=''
 if($From-match'^\s*"?([^"<]+?)"?\s*<'){$n=$Matches[1].Trim()}
 $p=@($n-split'\s+'|Where-Object{$_})
 [pscustomobject]@{First=if($p.Count){$p[0]}else{''};Last=if($p.Count-gt1){$p[-1]}else{''}}
}
function Get-MOSAddress([string]$Text){
 $p='\b\d{1,6}\s+[A-Za-z0-9][A-Za-z0-9.\-'' ]{1,80}\s(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Circle|Cir|Place|Pl|Parkway|Pkwy|Highway|Hwy|Trail|Trl|Way)\b'
 $m=[regex]::Match([string]$Text,$p,'IgnoreCase')
 if($m.Success){$m.Value.Trim()}else{''}
}
function Invoke-MOSLeadParser{
 Write-MOSHeader 'LM-005 Lead Parser'
 if(!(Test-Path $InputPath)){Write-MOSError 'LeadExtraction.json not found.';exit 1}
 $d=Get-Content $InputPath -Raw|ConvertFrom-Json
 $rows=@()
 foreach($x in @($d.candidates)){
  $n=Get-MOSName ([string]$x.From)
  $rows+=[pscustomobject]@{
   MessageId=$x.MessageId;ThreadId=$x.ThreadId;FirstName=$n.First;LastName=$n.Last
   Email=$x.PrimaryEmail;Phone=$x.PrimaryPhone;PropertyAddress=Get-MOSAddress ("$($x.Subject)`n$($x.Snippet)")
   Subject=$x.Subject;Snippet=$x.Snippet;Source=$x.Source;ParseState='PARSED';RequiresReview=[bool]$x.RequiresReview
  }
 }
 [ordered]@{
  release='MOS5-016';module='LM-005';generatedAt=(Get-Date).ToString('o');recordCount=$rows.Count
  records=$rows;previewOnly=$true;nextModule='LM-006_EntityRecognition'
 }|ConvertTo-Json -Depth 30|Set-Content $Output -Encoding UTF8
 Write-MOSSuccess 'LM-005 Lead Parser Ready'
}
Invoke-MOSLeadParser
exit 0
