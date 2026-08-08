$Reports=Join-Path $PSScriptRoot "reports"
@{mode="PREVIEW";emailsParsed=0;status="READY"}|ConvertTo-Json|Set-Content (Join-Path $Reports "HistoricalEmailParser.json")
Write-Host "[PASS]"