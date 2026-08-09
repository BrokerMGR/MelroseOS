<#
MelroseOS Enterprise
Validation : LM-Test-004
Name       : Duplicate Detection
Release    : MOS5-016
#>
$ErrorActionPreference='Stop'

$Root='D:\MelroseOS\GitHub\MelroseOS'
$Suite=Join-Path $Root 'tools\LeadMigration\ValidationSuite'
$Reports=Join-Path $Suite 'Reports'
if(!(Test-Path $Reports)){New-Item -ItemType Directory -Force -Path $Reports|Out-Null}

$records=@(
 [pscustomobject]@{MessageId='A';Fingerprint='same-fingerprint';Email='test@example.com';Phone='5045551212'},
 [pscustomobject]@{MessageId='B';Fingerprint='same-fingerprint';Email='test@example.com';Phone='5045551212'},
 [pscustomobject]@{MessageId='C';Fingerprint='unique-fingerprint';Email='other@example.com';Phone='9855551212'}
)

$seen=@{}
$duplicates=@()
foreach($r in $records){
 if($seen.ContainsKey($r.Fingerprint)){
  $duplicates+=[pscustomobject]@{MessageId=$r.MessageId;DuplicateOf=$seen[$r.Fingerprint];Fingerprint=$r.Fingerprint}
 }else{
  $seen[$r.Fingerprint]=$r.MessageId
 }
}

$passed=($duplicates.Count -eq 1 -and $duplicates[0].MessageId -eq 'B' -and $duplicates[0].DuplicateOf -eq 'A')
Write-Host ("[{0}] Duplicate detection produced {1} duplicate" -f ($(if($passed){'PASS'}else{'FAIL'})),$duplicates.Count)

[ordered]@{
 release='MOS5-016';test='LM-Test-004';generatedAt=(Get-Date).ToString('o')
 expectedDuplicates=1;actualDuplicates=$duplicates.Count;duplicates=$duplicates;passed=$passed
}|ConvertTo-Json -Depth 20|Set-Content (Join-Path $Reports 'Test-004-Duplicates.json') -Encoding UTF8

if(-not $passed){exit 1}
exit 0
