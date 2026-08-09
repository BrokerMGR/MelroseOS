<#
MelroseOS Enterprise
Package Manager Certification
Module : PKGCERT-009_Execution
Release: MOS5-018
#>
$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\PackageManager\Certification\Core\PKGCERT-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){Write-Host '[FAIL] PKGCERT-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

Write-PKGCertHeader 'PKGCERT-009 Execution'

$Scripts='D:\MelroseOS\GitHub\MelroseOS\PackageManager\Scripts'
$Results=@()
$Failed=0

for($i=1;$i -le 20;$i++){
    $Prefix='PKG-{0:D3}_' -f $i
    $Module=Get-ChildItem -LiteralPath $Scripts -Filter "$Prefix*.ps1" -File -ErrorAction SilentlyContinue|Select-Object -First 1

    if(-not $Module){
        $Failed++
        $Results+=[pscustomobject]@{module=$Prefix;exitCode=999;passed=$false;details='Module missing'}
        Write-PKGCertFail "$Prefix missing"
        continue
    }

    $psi=New-Object Diagnostics.ProcessStartInfo
    $psi.FileName='powershell.exe'
    $psi.Arguments="-NoProfile -ExecutionPolicy Bypass -File `"$($Module.FullName)`""
    $psi.UseShellExecute=$false
    $psi.RedirectStandardOutput=$true
    $psi.RedirectStandardError=$true
    $psi.CreateNoWindow=$true

    $p=[Diagnostics.Process]::Start($psi)
    $stdout=$p.StandardOutput.ReadToEnd()
    $stderr=$p.StandardError.ReadToEnd()
    $p.WaitForExit()

    $Passed=($p.ExitCode-eq0)
    if(-not $Passed){$Failed++}

    $Results+=[pscustomobject]@{
        module=$Module.Name
        exitCode=$p.ExitCode
        passed=$Passed
        stdout=$stdout
        stderr=$stderr
    }

    if($Passed){
        Write-PKGCertPass $Module.Name
    }else{
        Write-PKGCertFail "$($Module.Name) exit code $($p.ExitCode)"
    }
}

$Report=[ordered]@{
    release='MOS5-018'
    certification='PKGCERT-009'
    generatedAt=(Get-Date).ToString('o')
    failedCount=$Failed
    passed=($Failed-eq0)
    results=$Results
}

$Path=Write-PKGCertJson -Data $Report -FileName 'PKGCERT-009-Execution.json'

if($Failed-gt0){
    Write-PKGCertFail "Execution certification failed. Report: $Path"
    exit 1
}

Write-PKGCertPass "Execution certification passed. Report: $Path"
exit 0
