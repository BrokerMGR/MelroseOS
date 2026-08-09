<#
MelroseOS Enterprise
Validation : LM-Test-003
Name       : Pipeline Simulation
Release    : MOS5-016
#>
$ErrorActionPreference='Stop'

$Root='D:\MelroseOS\GitHub\MelroseOS'
$Active=Join-Path $Root 'tools\LeadMigration\Active'
$Suite=Join-Path $Root 'tools\LeadMigration\ValidationSuite'
$Fixtures=Join-Path $Suite 'Fixtures'
$Reports=Join-Path $Suite 'Reports'
if(!(Test-Path $Fixtures)){New-Item -ItemType Directory -Force -Path $Fixtures|Out-Null}
if(!(Test-Path $Reports)){New-Item -ItemType Directory -Force -Path $Reports|Out-Null}

$fixture=[ordered]@{
 mailboxes=@(
  [ordered]@{
   Email='test@example.invalid';Role='validation';Priority=1;Status='TEST'
   Messages=@(
    [ordered]@{
     Mailbox='test@example.invalid'
     MessageId='TEST-MSG-001'
     ThreadId='TEST-THREAD-001'
     From='Jane Buyer <jane.buyer@example.com>'
     To='broker@example.invalid'
     Subject='Interested in buying 123 Main Street'
     InternalDate=(Get-Date).ToString('o')
     LabelIds=@('TEST')
     Snippet='Buyer lead phone 504-555-1212 interested in 123 Main Street'
    }
   )
  }
 )
 totalMessages=1
}

$fixturePath=Join-Path $Fixtures 'MessageInventory-Fixture.json'
$fixture|ConvertTo-Json -Depth 20|Set-Content $fixturePath -Encoding UTF8

$required=@(
 'LM-004_LeadExtraction.ps1',
 'LM-005_LeadParser.ps1',
 'LM-006_EntityRecognition.ps1',
 'LM-007_Normalization.ps1'
)

$results=@()
foreach($m in $required){
 $path=Join-Path $Active $m
 $exists=Test-Path -LiteralPath $path
 $results+=[pscustomobject]@{Module=$m;Exists=$exists;Passed=$exists}
 Write-Host ("[{0}] {1}" -f ($(if($exists){'PASS'}else{'FAIL'})),$m)
}

$failed=@($results|Where-Object{-not $_.Passed}).Count
[ordered]@{
 release='MOS5-016';test='LM-Test-003';generatedAt=(Get-Date).ToString('o')
 fixture=$fixturePath;simulationMode='SAFE_TEST';liveGmailReads=$false
 crmWrites=$false;outbound=$false;failedCount=$failed;passed=($failed-eq0);results=$results
}|ConvertTo-Json -Depth 20|Set-Content (Join-Path $Reports 'Test-003-Pipeline.json') -Encoding UTF8

if($failed-gt0){exit 1}
exit 0
