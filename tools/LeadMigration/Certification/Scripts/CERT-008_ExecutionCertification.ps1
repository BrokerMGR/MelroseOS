<#
MelroseOS Enterprise
Certification : CERT-008
Name          : Execution Certification
Release       : MOS5-017A
#>

$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\tools\LeadMigration\Certification\Core\CERT-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){Write-Host '[FAIL] CERT-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

Write-CertHeader 'CERT-008 Execution Certification'

$Active='D:\MelroseOS\GitHub\MelroseOS\tools\LeadMigration\Active'
$Results=@()

for($i=1;$i -le 30;$i++){
    $prefix='LM-{0:D3}_' -f $i
    $m=Get-ChildItem -LiteralPath $Active -Filter "$prefix*.ps1" -File -ErrorAction SilentlyContinue|Select-Object -First 1

    if(-not $m){
        $Results+=[pscustomobject]@{Number=$i;Module=$prefix;ExitCode=999;Passed=$false;Details='Module missing'}
        Write-CertFail "$prefix missing"
        continue
    }

    $psi=New-Object Diagnostics.ProcessStartInfo
    $psi.FileName='powershell.exe'
    $psi.Arguments="-NoProfile -ExecutionPolicy Bypass -File `"$($m.FullName)`""
    $psi.UseShellExecute=$false
    $psi.RedirectStandardOutput=$true
    $psi.RedirectStandardError=$true
    $p=[Diagnostics.Process]::Start($psi)
    $stdout=$p.StandardOutput.ReadToEnd()
    $stderr=$p.StandardError.ReadToEnd()
    $p.WaitForExit()
    $code=$p.ExitCode
    $passed=($code-eq0)

    $Results+=[pscustomobject]@{
        Number=$i
        Module=$m.Name
        ExitCode=$code
        Passed=$passed
        StdOut=$stdout
        StdErr=$stderr
    }

    if($passed){Write-CertPass $m.Name}else{Write-CertFail "$($m.Name) exit code $code"}
}

$Failed=@($Results|Where-Object{-not $_.Passed}).Count
$Report=[ordered]@{
 release='MOS5-017A';targetRelease='MOS5-016';certification='CERT-008'
 generatedAt=(Get-Date).ToString('o');failedCount=$Failed;passed=($Failed-eq0);results=$Results
}
$Path=Write-CertJson -Data $Report -FileName 'CERT-008-Execution.json'
if($Failed-gt0){Write-CertFail "Execution certification failed. Report: $Path";exit 1}
Write-CertPass "Execution certification passed. Report: $Path"
exit 0
