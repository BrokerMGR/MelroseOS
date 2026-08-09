<#
MelroseOS Enterprise
Package Manager Certification
Module : PKGCERT-011_Repository
Release: MOS5-018
Version: 1.0.4
Purpose: Certify repository source state while excluding exact runtime-generated PackageManager state.
#>

$ErrorActionPreference='Stop'

$Common='D:\MelroseOS\GitHub\MelroseOS\PackageManager\Certification\Core\PKGCERT-000_Common.ps1'
if(!(Test-Path -LiteralPath $Common)){
    Write-Host '[FAIL] PKGCERT-000_Common.ps1 not found.' -ForegroundColor Red
    exit 1
}
. $Common

Write-PKGCertHeader 'PKGCERT-011 Repository'
Write-PKGCertInfo 'Repository validator version 1.0.4'

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
$StatusResult=Invoke-GitQuiet @('status','--porcelain=v1','--untracked-files=all')

$Branch=$BranchResult.StdOut
$Head=$HeadResult.StdOut
$Origin=$OriginResult.StdOut

$AllChanges=@()
if(-not [string]::IsNullOrWhiteSpace($StatusResult.StdOut)){
    $AllChanges=@(
        $StatusResult.StdOut -split "`r?`n" |
        Where-Object{-not [string]::IsNullOrWhiteSpace($_)}
    )
}

$SourceChanges=@()
$RuntimeChanges=@()

foreach($Line in $AllChanges){
    $Normalized=$Line.Replace('\','/')

    # Intentionally exact/simple matching. Git status prefix formatting is irrelevant.
    $IsRuntime = (
        $Normalized.Contains('PackageManager/Registry/packages.json') -or
        $Normalized.Contains('PackageManager/Reports/') -or
        $Normalized.Contains('PackageManager/Logs/') -or
        $Normalized.Contains('PackageManager/Snapshots/') -or
        $Normalized.Contains('PackageManager/Temp/') -or
        $Normalized.Contains('PackageManager/Packages/Cache/') -or
        $Normalized.Contains('PackageManager/Packages/Staging/') -or
        $Normalized.Contains('PackageManager/Packages/Rollback/') -or
        $Normalized.Contains('PackageManager/Certification/Reports/') -or
        $Normalized.Contains('PackageManager/Certification/Logs/') -or
        $Normalized.Contains('PackageManager/Certification/Temp/')
    )

    if($IsRuntime){
        $RuntimeChanges += $Line
    }else{
        $SourceChanges += $Line
    }
}

$Checks=@(
    [pscustomobject]@{
        name='Branch main'
        passed=($Branch -eq 'main')
        details="Branch=$Branch"
    },
    [pscustomobject]@{
        name='Local/remote sync'
        passed=($Head -and $Origin -and $Head -eq $Origin)
        details="HEAD=$Head"
    },
    [pscustomobject]@{
        name='Source working tree clean'
        passed=($SourceChanges.Count -eq 0)
        details=if($SourceChanges.Count -eq 0){
            'No pending source/config changes'
        }else{
            "$($SourceChanges.Count) pending source change(s): $($SourceChanges -join ' | ')"
        }
    }
)

$Failed=@($Checks|Where-Object{-not $_.passed}).Count

foreach($Check in $Checks){
    if($Check.passed){
        Write-PKGCertPass "$($Check.name) - $($Check.details)"
    }else{
        Write-PKGCertFail "$($Check.name) - $($Check.details)"
    }
}

if($RuntimeChanges.Count -gt 0){
    Write-PKGCertInfo "Ignoring $($RuntimeChanges.Count) expected generated/runtime change(s)."
    foreach($Change in $RuntimeChanges){
        Write-PKGCertInfo "Runtime: $Change"
    }
}

$Warnings=@(
    $BranchResult.StdErr,
    $HeadResult.StdErr,
    $OriginResult.StdErr,
    $StatusResult.StdErr
) | Where-Object{-not [string]::IsNullOrWhiteSpace($_)}

foreach($Warning in $Warnings){
    Write-PKGCertWarn $Warning
}

$Report=[ordered]@{
    release='MOS5-018'
    certification='PKGCERT-011'
    version='1.0.4'
    generatedAt=(Get-Date).ToString('o')
    branch=$Branch
    localHead=$Head
    remoteHead=$Origin
    sourceChanges=$SourceChanges
    ignoredRuntimeChanges=$RuntimeChanges
    gitWarnings=$Warnings
    failedCount=$Failed
    passed=($Failed -eq 0)
    checks=$Checks
}

$Out=Write-PKGCertJson -Data $Report -FileName 'PKGCERT-011-Repository.json'

if($Failed -gt 0){
    Write-PKGCertFail "Repository certification failed. Report: $Out"
    exit 1
}

Write-PKGCertPass "Repository certification passed. Report: $Out"
exit 0
