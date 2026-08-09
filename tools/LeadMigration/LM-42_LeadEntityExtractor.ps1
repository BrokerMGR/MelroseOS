param([Parameter(Mandatory=$true)][string]$InputPath,[string]$OutputPath="")
$ErrorActionPreference="Stop"
if(!(Test-Path $InputPath)){throw "Input file not found: $InputPath"}
function Emails($t){@([regex]::Matches([string]$t,'[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}','IgnoreCase')|%{$_.Value.ToLower()}|sort -Unique)}
function Phones($t){$o=@();[regex]::Matches([string]$t,'(?:\+?1[\s.\-]?)?(?:\(?\d{3}\)?[\s.\-]?)\d{3}[\s.\-]?\d{4}')|%{$d=$_.Value-replace'\D','';if($d.Length-eq11-and$d.StartsWith("1")){$d=$d.Substring(1)};if($d.Length-eq10){$o+=$d}};@($o|sort -Unique)}
$d=Get-Content $InputPath -Raw|ConvertFrom-Json;$m=if($d.messages){@($d.messages)}else{@($d)};$r=@()
foreach($x in $m){$b=if($x.PreferredBody){[string]$x.PreferredBody}else{[string]$x.body};$from=[string]$x.From;$name="";if($from-match'^\s*"?([^"<]+?)"?\s*<'){$name=$Matches[1].Trim()};$p=@($name-split'\s+'|?{$_});$e=Emails "$from`n$($x.Subject)`n$b";$ph=Phones "$from`n$($x.Subject)`n$b";$r+=[pscustomobject]@{MessageId=[string]$x.MessageId;ThreadId=[string]$x.ThreadId;Subject=[string]$x.Subject;From=$from;FirstName=if($p.Count){$p[0]}else{""};LastName=if($p.Count-gt1){$p[-1]}else{""};Emails=$e;Phones=$ph;PrimaryEmail=if($e.Count){$e[0]}else{""};PrimaryPhone=if($ph.Count){$ph[0]}else{""};Body=$b}}
if(!$OutputPath){$OutputPath=Join-Path $PSScriptRoot "reports\LeadEntities.json"}
@{release="MOS5-016-S1I";entityCount=$r.Count;entities=$r;previewOnly=$true}|ConvertTo-Json -Depth 30|Set-Content $OutputPath
Write-Host "[PASS] Lead entities extracted: $($r.Count)"