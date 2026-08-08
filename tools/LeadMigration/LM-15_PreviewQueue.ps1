$Reports=Join-Path $PSScriptRoot "reports"
$files="HistoricalEmailParser.json","LeadFingerprintEngine.json","DuplicateDetector.json","CRMMatcher.json"
$ok=0;foreach($f in $files){if(Test-Path (Join-Path $Reports $f)){$ok++}}
$status=if($ok -eq 4){"PASS"}else{"FAIL"}
@{status=$status;queueCount=0;commitEnabled=$false}|ConvertTo-Json|Set-Content (Join-Path $Reports "PreviewQueue.json")
if($status -eq "PASS"){Write-Host "[PASS]";exit 0}else{Write-Host "[FAIL]";exit 1}