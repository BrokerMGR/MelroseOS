$Reports=Join-Path $PSScriptRoot "reports"
$files="GmailConnector.json","LabelScan.json","MailboxScan.json","MessageInventory.json"
$ok=0;foreach($f in $files){if(Test-Path (Join-Path $Reports $f)){$ok++}}
$status=if($ok -eq 4){"PASS"}else{"FAIL"}
@{status=$status;passed=$ok;total=4}|ConvertTo-Json|Set-Content (Join-Path $Reports "DiscoveryStatistics.json")
if($status -eq "PASS"){Write-Host "[PASS]";exit 0}else{Write-Host "[FAIL]";exit 1}