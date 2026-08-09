<#
MelroseOS Enterprise
Validation : LM-Test-002
Name       : Module Load Validation
Release    : MOS5-016
#>
$ErrorActionPreference='Stop'

$Root='D:\MelroseOS\GitHub\MelroseOS'
$Active=Join-Path $Root 'tools\LeadMigration\Active'
$Suite=Join-Path $Root 'tools\LeadMigration\ValidationSuite'
$Reports=Join-Path $Suite 'Reports'
if(!(Test-Path $Reports)){New-Item -ItemType Directory -Force -Path $Reports|Out-Null}

$expected=@('LM-000_Common.ps1')
1..30|ForEach-Object{
 $n='{0:D3}' -f $_
 $match=Get-ChildItem -LiteralPath $Active -Filter "LM-$n*.ps1" -File -ErrorAction SilentlyContinue|Select-Object -First 1
 if($match){$expected+=$match.Name}else{$expected+="LM-$n*.ps1"}
}

$results=@()
foreach($name in $expected){
 $path=Join-Path $Active $name
 $exists=Test-Path -LiteralPath $path
 $size=if($exists){(Get-Item -LiteralPath $path).Length}else{0}
 $passed=($exists -and $size -gt 0)
 $results+=[pscustomobject]@{Module=$name;Exists=$exists;SizeBytes=$size;Passed=$passed}
 Write-Host ("[{0}] {1}" -f ($(if($passed){'PASS'}else{'FAIL'})),$name)
}

$failed=@($results|Where-Object{-not $_.Passed}).Count
[ordered]@{
 release='MOS5-016';test='LM-Test-002';generatedAt=(Get-Date).ToString('o')
 expectedCount=31;actualCount=$results.Count;failedCount=$failed;passed=($failed-eq0);results=$results
}|ConvertTo-Json -Depth 20|Set-Content (Join-Path $Reports 'Test-002-Modules.json') -Encoding UTF8

if($failed-gt0){exit 1}
exit 0
