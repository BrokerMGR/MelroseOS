<#
MelroseOS Enterprise
Package Manager Certification
Module : PKGCERT-011_Repository
Release: MOS5-018
#>
$ErrorActionPreference='Stop'
$Common='D:\MelroseOS\GitHub\MelroseOS\PackageManager\Certification\Core\PKGCERT-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){Write-Host '[FAIL] PKGCERT-000_Common.ps1 not found.' -ForegroundColor Red;exit 1}
. $Common

Write-PKGCertHeader 'PKGCERT-011 Repository'

$Root='D:\MelroseOS\GitHub\MelroseOS'

function Invoke-GitQuiet {
    param([string[]]$Arguments)

    $psi=New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName='git.exe'
    $psi.Arguments=($Arguments -join ' ')
    $psi.WorkingDirectory=$Root
    $psi.UseShellExecute=$false
    $psi.RedirectStandardOutput=$true
    $psi.RedirectStandardError=$true
    $psi.CreateNoWindow=$true

    $p=New-Object System.Diagnostics.Process
    $p.StartInfo=$psi
    $null=$p.Start()
    $stdout=$p.StandardOutput.ReadToEnd()
    $stderr=$p.StandardError.ReadToEnd()
    $p.WaitForExit()

    [pscustomobject]@{
        ExitCode=$p.ExitCode
        StdOut=$stdout.Trim()
        StdErr=$stderr.Trim()
    }
}

$BranchResult=Invoke-GitQuiet @('branch','--show-current')
$HeadResult=Invoke-GitQuiet @('rev-parse','HEAD')
$OriginResult=Invoke-GitQuiet @('rev-parse','origin/main')
$StatusResult=Invoke-GitQuiet @('status','--porcelain')

$Branch=$BranchResult.StdOut
$Head=$HeadResult.StdOut
$Origin=$OriginResult.StdOut

$AllChanges=@()
if(-not [string]::IsNullOrWhiteSpace($StatusResult.StdOut)){
    $AllChanges=@($StatusResult.StdOut -split "`r?`n" | Where-Object{-not [string]::IsNullOrWhiteSpace($_)})
}

$GeneratedPrefixes=@(
    'PackageManager/Reports/',
    'PackageManager/Logs/',
    'PackageManager/Snapshots/',
    'PackageManager/Certification/Reports/',
    'PackageManager/Certification/Logs/',
    'PackageManager/Certification/Temp/'
)

$SourceChanges=@()
$GeneratedChanges=@()

foreach($Line in $AllChanges){
    $Path=if($Line.Length -gt 3){$Line.Substring(3).Trim()}else{$Line}
    $Norm=$Path.Replace('\','/')
    $Generated=$false

    foreach($Prefix in $GeneratedPrefixes){
        if($Norm.StartsWith($Prefix,[System.StringComparison]::OrdinalIgnoreCase)){
            $Generated=$true
            break
        }
    }

    if($Generated){$GeneratedChanges+=$Line}else{$SourceChanges+=$Line}
}

$Checks=@(
    [pscustomobject]@{name='Branch main';passed=($Branch -eq 'main');details="Branch=$Branch"},
    [pscustomobject]@{name='Local/remote sync';passed=($Head -and $Origin -and $Head -eq $Origin);details="HEAD=$Head"},
    [pscustomobject]@{name='Source working tree clean';passed=($SourceChanges.Count-eq0);details="$($SourceChanges.Count) pending source change(s)"}
)

$Failed=@($Checks|Where-Object{-not $_.passed}).Count

foreach($Check in $Checks){
    if($Check.passed){Write-PKGCertPass "$($Check.name) - $($Check.details)"}else{Write-PKGCertFail "$($Check.name) - $($Check.details)"}
}

if($GeneratedChanges.Count -gt 0){
    Write-PKGCertInfo "Ignoring $($GeneratedChanges.Count) expected generated change(s)."
}

$Warnings=@(
    $BranchResult.StdErr,$HeadResult.StdErr,$OriginResult.StdErr,$StatusResult.StdErr
)|Where-Object{-not [string]::IsNullOrWhiteSpace($_)}

foreach($Warning in $Warnings){
    Write-PKGCertWarn $Warning
}

$Report=[ordered]@{
    release='MOS5-018'
    certification='PKGCERT-011'
    generatedAt=(Get-Date).ToString('o')
    branch=$Branch
    localHead=$Head
    remoteHead=$Origin
    sourceChanges=$SourceChanges
    ignoredGeneratedChanges=$GeneratedChanges
    gitWarnings=$Warnings
    failedCount=$Failed
    passed=($Failed-eq0)
    checks=$Checks
}

$Out=Write-PKGCertJson -Data $Report -FileName 'PKGCERT-011-Repository.json'
if($Failed-gt0){Write-PKGCertFail "Repository certification failed. Report: $Out";exit 1}
Write-PKGCertPass "Repository certification passed. Report: $Out"
exit 0
