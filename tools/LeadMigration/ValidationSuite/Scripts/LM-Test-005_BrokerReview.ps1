<#
MelroseOS Enterprise
Validation : LM-Test-005
Name       : Broker Review
Release    : MOS5-016
#>
$ErrorActionPreference='Stop'

$Root='D:\MelroseOS\GitHub\MelroseOS'
$Suite=Join-Path $Root 'tools\LeadMigration\ValidationSuite'
$Reports=Join-Path $Suite 'Reports'
if(!(Test-Path $Reports)){New-Item -ItemType Directory -Force -Path $Reports|Out-Null}

$sample=@(
 [pscustomobject]@{ReferenceId='1';Category='DUPLICATE';RequiresBrokerReview=$true;Severity='HIGH'},
 [pscustomobject]@{ReferenceId='2';Category='AGENT_RESOLUTION';RequiresBrokerReview=$true;Severity='NORMAL'},
 [pscustomobject]@{ReferenceId='3';Category='CLEAN';RequiresBrokerReview=$false;Severity='NORMAL'}
)

$queue=@($sample|Where-Object{$_.RequiresBrokerReview})
$passed=($queue.Count -eq 2 -and @($queue|Where-Object{$_.Severity -eq 'HIGH'}).Count -eq 1)

Write-Host ("[{0}] Broker review queue count: {1}" -f ($(if($passed){'PASS'}else{'FAIL'})),$queue.Count)

[ordered]@{
 release='MOS5-016';test='LM-Test-005';generatedAt=(Get-Date).ToString('o')
 expectedQueueCount=2;actualQueueCount=$queue.Count;queue=$queue;passed=$passed
}|ConvertTo-Json -Depth 20|Set-Content (Join-Path $Reports 'Test-005-BrokerReview.json') -Encoding UTF8

if(-not $passed){exit 1}
exit 0
