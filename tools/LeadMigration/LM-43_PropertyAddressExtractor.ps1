param([Parameter(Mandatory=$true)][string]$InputPath,[string]$OutputPath="")
$ErrorActionPreference="Stop";if(!(Test-Path $InputPath)){throw "Input file not found"}
$d=Get-Content $InputPath -Raw|ConvertFrom-Json;$e=if($d.entities){@($d.entities)}else{@($d)};$r=@()
$pat='\b\d{1,6}\s+[A-Za-z0-9][A-Za-z0-9.\-'' ]{1,80}\s(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Circle|Cir|Place|Pl|Parkway|Pkwy|Highway|Hwy|Trail|Trl|Way)\b'
foreach($x in $e){$a=@([regex]::Matches("$($x.Subject)`n$($x.Body)",$pat,'IgnoreCase')|%{$_.Value.Trim()}|sort -Unique);$r+=[pscustomobject]@{MessageId=$x.MessageId;ThreadId=$x.ThreadId;FirstName=$x.FirstName;LastName=$x.LastName;PrimaryEmail=$x.PrimaryEmail;PrimaryPhone=$x.PrimaryPhone;PropertyAddresses=$a;PrimaryPropertyAddress=if($a.Count){$a[0]}else{""}}}
if(!$OutputPath){$OutputPath=Join-Path $PSScriptRoot "reports\LeadEntitiesWithAddresses.json"}
@{release="MOS5-016-S1I";recordCount=$r.Count;records=$r;previewOnly=$true}|ConvertTo-Json -Depth 30|Set-Content $OutputPath
Write-Host "[PASS] Property addresses extracted: $($r.Count)"