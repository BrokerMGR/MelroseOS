<#
MelroseOS Enterprise
Validation : LM-Test-001
Name       : Structure Validation
Release    : MOS5-016
#>
$ErrorActionPreference='Stop'

$Root='D:\MelroseOS\GitHub\MelroseOS'
$LMRoot=Join-Path $Root 'tools\LeadMigration'
$Suite=Join-Path $LMRoot 'ValidationSuite'
$Reports=Join-Path $Suite 'Reports'
if(!(Test-Path $Reports)){New-Item -ItemType Directory -Force -Path $Reports|Out-Null}

$checks=@(
 @{Name='Repository';Path=$Root},
 @{Name='CoreModules';Path=(Join-Path $Root 'CoreModules')},
 @{Name='Development';Path=(Join-Path $Root 'Development')},
 @{Name='Build';Path=(Join-Path $Root 'Build')},
 @{Name='LeadMigration';Path=$LMRoot},
 @{Name='Active';Path=(Join-Path $LMRoot 'Active')},
 @{Name='ValidationSuite';Path=$Suite},
 @{Name='ValidationScripts';Path=(Join-Path $Suite 'Scripts')},
 @{Name='ValidationReports';Path=$Reports}
)

$results=@()
foreach($c in $checks){
 $exists=Test-Path -LiteralPath $c.Path
 $results+=[pscustomobject]@{Check=$c.Name;Path=$c.Path;Passed=$exists}
 Write-Host ("[{0}] {1}" -f ($(if($exists){'PASS'}else{'FAIL'})),$c.Name)
}

$failed=@($results|Where-Object{-not $_.Passed}).Count
[ordered]@{
 release='MOS5-016';test='LM-Test-001';generatedAt=(Get-Date).ToString('o')
 passed=($failed-eq0);failedCount=$failed;results=$results
}|ConvertTo-Json -Depth 20|Set-Content (Join-Path $Reports 'Test-001-Structure.json') -Encoding UTF8

if($failed-gt0){exit 1}
exit 0
