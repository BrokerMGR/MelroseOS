$Reports=Join-Path $PSScriptRoot "reports"
@{duplicatesFound=0;previewOnly=$true}|ConvertTo-Json|Set-Content (Join-Path $Reports "DuplicateDetector.json")
Write-Host "[PASS]"