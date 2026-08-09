<#
MelroseOS Enterprise
Certification : CERT-011
Name          : Performance Certification
Release       : MOS5-017A
#>

$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\tools\LeadMigration\Certification\Core\CERT-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){Write-Host '[FAIL] CERT-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

Write-CertHeader 'CERT-011 Performance Certification'

$Inventory=Get-CertModuleInventory
$Results=@()

foreach($m in $Inventory){
    if([string]::IsNullOrWhiteSpace([string]$m.Path) -or -not (Test-Path -LiteralPath $m.Path)){
        $Results+=[pscustomobject]@{Module=$m.Name;SizeBytes=0;ParseMilliseconds=0;Passed=$false;Details='Missing'}
        Write-CertFail "$($m.Name) missing"
        continue
    }

    $file=Get-Item -LiteralPath $m.Path
    $sw=[Diagnostics.Stopwatch]::StartNew()
    $tokens=$null
    $errors=$null
    [Management.Automation.Language.Parser]::ParseFile($m.Path,[ref]$tokens,[ref]$errors)|Out-Null
    $sw.Stop()

    $passed=($errors.Count-eq0 -and $sw.ElapsedMilliseconds -lt 5000 -and $file.Length -lt 1048576)

    $Results+=[pscustomobject]@{
        Module=$m.Name
        SizeBytes=$file.Length
        ParseMilliseconds=$sw.ElapsedMilliseconds
        SyntaxErrors=$errors.Count
        Passed=$passed
        Details=if($passed){'Within certification thresholds'}else{'Exceeded threshold or syntax error'}
    }

    if($passed){
        Write-CertPass "$($m.Name): $($file.Length) bytes / $($sw.ElapsedMilliseconds) ms"
    }else{
        Write-CertFail "$($m.Name): performance threshold failed"
    }
}

$Failed=@($Results|Where-Object{-not $_.Passed}).Count
$Report=[ordered]@{
    release='MOS5-017A'
    targetRelease='MOS5-016'
    certification='CERT-011'
    generatedAt=(Get-Date).ToString('o')
    maxModuleBytes=1048576
    maxParseMilliseconds=5000
    failedCount=$Failed
    passed=($Failed-eq0)
    results=$Results
}
$Path=Write-CertJson -Data $Report -FileName 'CERT-011-Performance.json'
if($Failed-gt0){Write-CertFail "Performance certification failed. Report: $Path";exit 1}
Write-CertPass "Performance certification passed. Report: $Path"
exit 0
