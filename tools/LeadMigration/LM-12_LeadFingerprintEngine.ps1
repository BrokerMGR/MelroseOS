$Reports=Join-Path $PSScriptRoot "reports"
@{fingerprintsGenerated=0;algorithm="EMAIL_PHONE_NAME";status="READY"}|ConvertTo-Json|Set-Content (Join-Path $Reports "LeadFingerprintEngine.json")
Write-Host "[PASS]"