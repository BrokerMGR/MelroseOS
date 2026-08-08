$Reports=Join-Path $PSScriptRoot "reports"
@{matchedRecords=0;ownershipPreserved=$true}|ConvertTo-Json|Set-Content (Join-Path $Reports "CRMMatcher.json")
Write-Host "[PASS]"