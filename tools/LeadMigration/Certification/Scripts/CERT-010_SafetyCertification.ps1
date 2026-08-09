<#
MelroseOS Enterprise
Certification : CERT-010
Name          : Safety Certification
Release       : MOS5-017A
#>

$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\tools\LeadMigration\Certification\Core\CERT-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){Write-Host '[FAIL] CERT-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

Write-CertHeader 'CERT-010 Safety Certification'

$Inventory=Get-CertModuleInventory
$Results=@()

$ForbiddenPatterns=@(
    '(?i)Send-MailMessage',
    '(?i)Gmail.*Send',
    '(?i)MailApp\.sendEmail',
    '(?i)GmailApp\.sendEmail',
    '(?i)Remove-Item\s+.*-Recurse.*-Force',
    '(?i)del\s+/s\s+/q',
    '(?i)crmWritesEnabled\s*=\s*\$true',
    '(?i)outboundEnabled\s*=\s*\$true',
    '(?i)destructiveActionsEnabled\s*=\s*\$true'
)

foreach($m in $Inventory){
    if([string]::IsNullOrWhiteSpace([string]$m.Path) -or -not (Test-Path -LiteralPath $m.Path)){
        $Results+=[pscustomobject]@{Module=$m.Name;Passed=$false;Violations=@('Module missing')}
        Write-CertFail "$($m.Name) missing"
        continue
    }

    $text=[IO.File]::ReadAllText($m.Path)
    $violations=@()

    foreach($pattern in $ForbiddenPatterns){
        if($text -match $pattern){$violations+=$pattern}
    }

    $passed=($violations.Count-eq0)

    $Results+=[pscustomobject]@{
        Module=$m.Name
        Passed=$passed
        Violations=$violations
    }

    if($passed){Write-CertPass $m.Name}else{Write-CertFail "$($m.Name) contains blocked safety pattern(s)"}
}

$Failed=@($Results|Where-Object{-not $_.Passed}).Count
$Report=[ordered]@{
    release='MOS5-017A'
    targetRelease='MOS5-016'
    certification='CERT-010'
    generatedAt=(Get-Date).ToString('o')
    failedCount=$Failed
    passed=($Failed-eq0)
    crmWritesAllowed=$false
    outboundAllowed=$false
    destructiveActionsAllowed=$false
    results=$Results
}
$Path=Write-CertJson -Data $Report -FileName 'CERT-010-Safety.json'
if($Failed-gt0){Write-CertFail "Safety certification failed. Report: $Path";exit 1}
Write-CertPass "Safety certification passed. Report: $Path"
exit 0
