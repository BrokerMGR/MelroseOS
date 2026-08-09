$ErrorActionPreference='Stop'
. 'D:\MelroseOS\GitHub\MelroseOS\RecruitingEngine\Certification\Core\RECCERT-000_Common.ps1'

Write-RECCertHeader 'RECCERT-005 Repository'

$Root='D:\MelroseOS\GitHub\MelroseOS'

function GitRun([string[]]$Args){
    $psi=New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName='git.exe'
    $psi.Arguments=($Args -join ' ')
    $psi.WorkingDirectory=$Root
    $psi.UseShellExecute=$false
    $psi.RedirectStandardOutput=$true
    $psi.RedirectStandardError=$true
    $psi.CreateNoWindow=$true
    $p=New-Object System.Diagnostics.Process
    $p.StartInfo=$psi
    $null=$p.Start()
    $o=$p.StandardOutput.ReadToEnd()
    $e=$p.StandardError.ReadToEnd()
    $p.WaitForExit()
    [pscustomobject]@{code=$p.ExitCode;out=$o.Trim();err=$e.Trim()}
}

$Branch=GitRun @('branch','--show-current')
$Local=GitRun @('rev-parse','HEAD')
$Remote=GitRun @('rev-parse','origin/main')
$Status=GitRun @('status','--porcelain=v1','--untracked-files=all')

$Lines=@()
if($Status.out){$Lines=@($Status.out -split "`r?`n"|Where-Object{$_})}

$Source=@()
$Runtime=@()

foreach($Line in $Lines){
    $N=$Line.Replace('\','/')
    $IsRuntime=(
        $N.Contains('RecruitingEngine/Certification/Reports/') -or
        $N.Contains('RecruitingEngine/Reports/') -or
        $N.Contains('RecruitingEngine/Logs/') -or
        $N.Contains('RecruitingEngine/Temp/')
    )
    if($IsRuntime){$Runtime+=$Line}else{$Source+=$Line}
}

$Checks=@(
    [pscustomobject]@{name='Branch main';passed=($Branch.out -eq 'main');detail=$Branch.out},
    [pscustomobject]@{name='Local/remote sync';passed=($Local.out -and $Local.out -eq $Remote.out);detail=$Local.out},
    [pscustomobject]@{name='Source tree clean';passed=($Source.Count -eq 0);detail=if($Source.Count){$Source -join ' | '}else{'No pending source changes'}}
)

$Failed=@($Checks|Where-Object{-not $_.passed}).Count

foreach($C in $Checks){
    if($C.passed){Write-RECCertPass "$($C.name) - $($C.detail)"}else{Write-RECCertFail "$($C.name) - $($C.detail)"}
}

if($Runtime.Count){
    Write-RECCertInfo "Ignoring $($Runtime.Count) generated/runtime change(s)."
}

foreach($Warn in @($Branch.err,$Local.err,$Remote.err,$Status.err)|Where-Object{$_}){
    Write-RECCertWarn $Warn
}

$Report=[ordered]@{
    release='MOS5-021'
    certification='RECCERT-005'
    branch=$Branch.out
    localHead=$Local.out
    remoteHead=$Remote.out
    sourceChanges=$Source
    ignoredRuntimeChanges=$Runtime
    failedCount=$Failed
    passed=($Failed-eq0)
    checks=$Checks
}

$Out=Write-RECCertJson -Data $Report -FileName 'RECCERT-005-Repository.json'
if($Failed){Write-RECCertFail "Repository certification failed. Report: $Out";exit 1}
Write-RECCertPass "Repository certification passed. Report: $Out"
exit 0
