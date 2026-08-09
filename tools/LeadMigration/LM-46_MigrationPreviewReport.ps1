param([Parameter(Mandatory=$true)][string]$InputPath,[string]$OutputPath="")
$ErrorActionPreference="Stop";$d=Get-Content $InputPath -Raw|ConvertFrom-Json;$c=if($d.candidates){@($d.candidates)}else{@($d)}
$m=@($c|?{$_.Action-eq"MERGE_RECOMMENDED"}).Count;$b=@($c|?{$_.Action-eq"BROKER_REVIEW"}).Count;$n=@($c|?{$_.Action-eq"NEW_LEAD_CANDIDATE"}).Count;$o=@($c|?{$_.PreserveExistingOwnership}).Count
if(!$OutputPath){$OutputPath=Join-Path $PSScriptRoot "reports\MigrationPreviewReport.json"};@{release="MOS5-016-S1I";totalCandidates=$c.Count;mergeRecommended=$m;brokerReview=$b;newLeadCandidates=$n;ownershipLocksDetected=$o;previewOnly=$true;crmWritesEnabled=$false;candidates=$c}|ConvertTo-Json -Depth 40|Set-Content $OutputPath
Write-Host "[PASS] Migration preview generated."